import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/audit/server-audit";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { ownerInvitationSchema } from "@/lib/validators/schemas";

export async function GET() {
  const auth = await requireApiAuth(["admin"]);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.ctx;

  const { data, error } = await supabase
    .from("owner_invitations")
    .select("email, invited_by, created_at, expires_at, used_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invitations: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = ownerInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86400000).toISOString()
    : null;

  const { error } = await supabase
    .from("owner_invitations")
    .upsert({
      email,
      invited_by: user.id,
      expires_at: expiresAt,
      used_at: null,
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await recordAuditEvent({
    actorId: user.id,
    action: "admin.invitation_created",
    entity: "owner_invitations",
    targetType: "invitation",
    targetId: email,
    result: "success",
    details: { invited_email: email, expires_at: expiresAt },
  });

  return NextResponse.json({ ok: true, email }, { status: 201 });
}
