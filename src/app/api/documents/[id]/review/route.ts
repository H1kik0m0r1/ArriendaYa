import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { documentReviewSchema } from "@/lib/validators/schemas";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = documentReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado de revisión inválido" }, { status: 400 });
  }

  const { data: docRow } = await supabase
    .from("request_documents")
    .select("id, request_id, request:rental_requests(property:properties(owner_id))")
    .eq("id", id)
    .single();

  const ownerId = (
    (docRow?.request as { property?: { owner_id?: string } } | null)?.property
  )?.owner_id;

  if (!docRow || (ownerId !== user.id && profile.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado para revisar este documento" }, { status: 403 });
  }

  const { error } = await supabase
    .from("request_documents")
    .update({ status: parsed.data.status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: parsed.data.status });
}
