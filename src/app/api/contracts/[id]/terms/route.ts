import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { contractTermsSchema } from "@/lib/validators/schemas";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = contractTermsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
  }

  if (parsed.data.endDate < parsed.data.startDate) {
    return NextResponse.json({ error: "La fecha de fin debe ser posterior a la de inicio" }, { status: 400 });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, owner_id, status, owner_signature_url, tenant_signature_url, signed_at")
    .eq("id", id)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }
  if (contract.owner_id !== user.id && profile.role !== "admin") {
    return NextResponse.json({ error: "Solo el propietario puede editar los términos" }, { status: 403 });
  }
  if (
    contract.status !== "pending_signatures" ||
    contract.owner_signature_url ||
    contract.tenant_signature_url ||
    contract.signed_at
  ) {
    return NextResponse.json(
      { error: "No se pueden modificar los términos de un contrato firmado o activo" },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("contracts")
    .update({
      terms: parsed.data.terms,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
