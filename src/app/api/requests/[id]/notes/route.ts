import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { requestNoteSchema } from "@/lib/validators/schemas";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = requestNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Nota inválida" }, { status: 400 });
  }

  const { data: reqRow } = await supabase
    .from("rental_requests")
    .select("id, property:properties(owner_id)")
    .eq("id", id)
    .single();
  const ownerId = (reqRow?.property as { owner_id?: string } | null)?.owner_id;
  if (!reqRow || (ownerId !== user.id && profile.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado para comentar esta solicitud" }, { status: 403 });
  }

  const { data: note, error } = await supabase
    .from("request_notes")
    .insert({
      request_id: id,
      author_id: user.id,
      text: parsed.data.text,
    })
    .select("id, text, created_at")
    .single();

  if (error || !note) {
    return NextResponse.json({ error: error?.message || "Error al guardar nota" }, { status: 400 });
  }

  return NextResponse.json({ note }, { status: 201 });
}
