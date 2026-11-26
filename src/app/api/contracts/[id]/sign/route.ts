import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { contractSignSchema } from "@/lib/validators/schemas";
import { PRIVATE_BUCKET_RULES, hasValidMagicBytes } from "@/lib/storage/private-files";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "tenant", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = contractSignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Formato de firma inválido" }, { status: 400 });
  }

  const base64Data = parsed.data.signatureDataUrl.replace(/^data:image\/png;base64,/, "");
  const bytes = Uint8Array.from(Buffer.from(base64Data, "base64"));

  if (bytes.length === 0 || bytes.length > PRIVATE_BUCKET_RULES.signatures.maxSizeBytes) {
    return NextResponse.json({ error: "Tamaño de firma inválido" }, { status: 400 });
  }
  if (!hasValidMagicBytes(bytes, "image/png")) {
    return NextResponse.json({ error: "La firma debe ser una imagen PNG válida" }, { status: 400 });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }

  const isOwner = contract.owner_id === user.id;
  const isTenant = contract.tenant_id === user.id;
  if (!isOwner && !isTenant) {
    return NextResponse.json({ error: "No autorizado para firmar este contrato" }, { status: 403 });
  }
  if (contract.status !== "pending_signatures") {
    return NextResponse.json({ error: "El contrato ya no admite firmas" }, { status: 409 });
  }
  if (isOwner && contract.owner_signature_url) {
    return NextResponse.json({ error: "El propietario ya firmó este contrato" }, { status: 409 });
  }
  if (isTenant && contract.tenant_signature_url) {
    return NextResponse.json({ error: "El inquilino ya firmó este contrato" }, { status: 409 });
  }

  const roleSlug = isOwner ? "owner" : "tenant";
  const path = `${contract.id}/${user.id}-${roleSlug}-${randomUUID()}.png`;

  const { error: upErr } = await supabase.storage
    .from("signatures")
    .upload(path, bytes, { contentType: "image/png", upsert: false });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  const updatePayload: Record<string, string> = isOwner
    ? { owner_signature_url: path }
    : { tenant_signature_url: path };

  const { data: updatedContract, error: updErr } = await supabase
    .from("contracts")
    .update(updatePayload)
    .eq("id", id)
    .select("status")
    .single();

  if (updErr) {
    const cleanupClient = createAdminClient() ?? supabase;
    await cleanupClient.storage.from("signatures").remove([path]).catch(() => {});
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  const finalized = updatedContract?.status === "active";

  return NextResponse.json({ ok: true, finalized, path });
}
