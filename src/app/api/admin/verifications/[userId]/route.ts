import { NextResponse } from "next/server";
import { isMissingColumnError, requireAdminService } from "@/lib/admin/server-helpers";
import { recordAuditEvent } from "@/lib/audit/server-audit";
import { insertServerNotifications } from "@/lib/notifications/server-notify";
import { ownerVerificationReviewSchema } from "@/modules/admin/schemas";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ userId: string }> }
) {
  const guard = await requireAdminService();
  if (!guard.ok) return guard.response;
  const {
    ctx: { user },
    admin,
  } = guard;
  const { userId } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = ownerVerificationReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 }
    );
  }

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("id", userId)
    .maybeSingle();

  if (!targetProfile || targetProfile.role !== "owner") {
    return NextResponse.json(
      { error: "Propietario no encontrado para verificación" },
      { status: 404 }
    );
  }

  const nowIso = new Date().toISOString();
  const fullPayload = {
    user_id: userId,
    status: parsed.data.status,
    email_verified: parsed.data.email_verified ?? parsed.data.status === "verificado",
    phone_verified: parsed.data.phone_verified ?? parsed.data.status === "verificado",
    notes: parsed.data.notes || null,
    reviewed_by: user.id,
    reviewed_at: nowIso,
  };

  let { error } = await admin
    .from("owner_verifications")
    .upsert(fullPayload, { onConflict: "user_id" });

  if (error && isMissingColumnError(error)) {
    const legacyRes = await admin.from("owner_verifications").upsert(
      {
        user_id: userId,
        status: parsed.data.status,
        email_verified: fullPayload.email_verified,
        phone_verified: fullPayload.phone_verified,
      },
      { onConflict: "user_id" }
    );
    error = legacyRes.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await Promise.all([
    recordAuditEvent({
      actorId: user.id,
      action: "admin.owner_verification_updated",
      entity: "owner_verifications",
      targetType: "owner",
      targetId: userId,
      result: "success",
      details: {
        status: parsed.data.status,
        email_verified: fullPayload.email_verified,
        phone_verified: fullPayload.phone_verified,
      },
    }),
    insertServerNotifications([
      {
        user_id: userId,
        type: "owner_verification",
        title: `Verificación de propietario: ${parsed.data.status}`,
        message:
          parsed.data.notes ||
          `Tu estado de verificación fue actualizado a "${parsed.data.status}" por administración.`,
        link: "/profile",
      },
    ]),
  ]);

  return NextResponse.json({ ok: true });
}
