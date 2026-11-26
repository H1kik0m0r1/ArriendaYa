import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const DOC_FILENAME_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$/i;

const verificationSubmitSchema = z.object({
  identityDocPath: z.string().trim().min(5, "Ruta de documento inválida"),
});

export async function GET() {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const { data, error } = await supabase
    .from("owner_verifications")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ verification: data ?? null });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = verificationSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Documento inválido" },
      { status: 400 }
    );
  }

  const path = parsed.data.identityDocPath;
  const parts = path.split("/");
  if (parts.length !== 2 || parts[0] !== user.id || !DOC_FILENAME_REGEX.test(parts[1])) {
    return NextResponse.json({ error: "Ruta de documento de verificación no autorizada" }, { status: 403 });
  }

  const storageClient = createAdminClient() ?? supabase;
  const { data: listed, error: listErr } = await storageClient.storage
    .from("identity-documents")
    .list(user.id, { search: parts[1] });

  if (listErr || !listed?.some((f: { name: string }) => f.name === parts[1])) {
    return NextResponse.json({ error: "El documento indicado no existe en Storage" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("owner_verifications")
    .upsert(
      {
        user_id: user.id,
        identity_doc_url: path,
        status: "pendiente",
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "No se pudo registrar la verificación" },
      { status: 400 }
    );
  }

  return NextResponse.json({ verification: data });
}
