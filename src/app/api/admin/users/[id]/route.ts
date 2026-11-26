import { NextResponse } from "next/server";
import { isMissingColumnError, requireAdminService } from "@/lib/admin/server-helpers";
import { recordAuditEvent } from "@/lib/audit/server-audit";
import { insertServerNotifications } from "@/lib/notifications/server-notify";
import { userStatusActionSchema } from "@/modules/admin/schemas";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminService();
  if (!guard.ok) return guard.response;
  const {
    ctx: { user },
    admin,
  } = guard;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = userStatusActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 }
    );
  }

  const { data: targetRaw, error: targetErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (targetErr) {
    return NextResponse.json({ error: targetErr.message }, { status: 400 });
  }
  if (!targetRaw) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const target = targetRaw as Record<string, unknown>;
  const targetRole = String(target.role || "");
  const targetEmail = String(target.email || "");

  if (id === user.id) {
    await recordAuditEvent({
      actorId: user.id,
      action: `admin.user_${parsed.data.action}`,
      entity: "profiles",
      targetType: "user",
      targetId: id,
      result: "denied",
      details: { reason: "self_action_blocked" },
    });
    return NextResponse.json(
      { error: "Un administrador no puede suspender ni reactivar su propia cuenta." },
      { status: 400 }
    );
  }

  if (parsed.data.action === "suspend" && targetRole === "admin") {
    const { data: otherAdmins } = await admin
      .from("profiles")
      .select("id, suspended_at")
      .eq("role", "admin")
      .neq("id", id);

    const hasAnotherActiveAdmin = ((otherAdmins as Array<Record<string, unknown>> | null) ?? []).some(
      (a) => !a.suspended_at
    );
    if (!hasAnotherActiveAdmin) {
      await recordAuditEvent({
        actorId: user.id,
        action: "admin.user_suspend",
        entity: "profiles",
        targetType: "user",
        targetId: id,
        result: "denied",
        details: { reason: "last_active_admin_protected" },
      });
      return NextResponse.json(
        { error: "No se puede suspender al último administrador activo de la plataforma." },
        { status: 409 }
      );
    }
  }

  const isSuspending = parsed.data.action === "suspend";
  const nextSuspendedAt = isSuspending ? new Date().toISOString() : null;
  const nextSuspendedReason = isSuspending ? (parsed.data.reason || "").trim() : null;
  const nextSuspendedBy = isSuspending ? user.id : null;

  // Persistimos en profiles sin tocar `role`
  const { error: updateErr } = await admin
    .from("profiles")
    .update({
      suspended_at: nextSuspendedAt,
      suspended_reason: nextSuspendedReason,
      suspended_by: nextSuspendedBy,
    })
    .eq("id", id);

  if (updateErr) {
    if (isMissingColumnError(updateErr)) {
      return NextResponse.json(
        { error: "Falta ejecutar la migración 0006_admin_panel.sql en Supabase para suspender cuentas en base de datos." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  // Sincronizar bloqueo/desbloqueo en Supabase Auth
  const { error: authBanErr } = await admin.auth.admin.updateUserById(id, {
    ban_duration: isSuspending ? "876000h" : "none",
  });
  if (authBanErr) {
    // Revertimos profiles si Auth falla para mantener consistencia
    await admin
      .from("profiles")
      .update({
        suspended_at: (target.suspended_at as string | null) ?? null,
        suspended_reason: (target.suspended_reason as string | null) ?? null,
        suspended_by: (target.suspended_by as string | null) ?? null,
      })
      .eq("id", id);

    await recordAuditEvent({
      actorId: user.id,
      action: isSuspending ? "admin.user_suspend" : "admin.user_reactivate",
      entity: "profiles",
      targetType: "user",
      targetId: id,
      result: "error",
      details: { auth_sync_failed: authBanErr.message },
    });
    return NextResponse.json(
      { error: `No se pudo sincronizar el estado en Supabase Auth: ${authBanErr.message}` },
      { status: 502 }
    );
  }

  await Promise.all([
    recordAuditEvent({
      actorId: user.id,
      action: isSuspending ? "admin.user_suspend" : "admin.user_reactivate",
      entity: "profiles",
      targetType: "user",
      targetId: id,
      result: "success",
      details: {
        target_email: targetEmail,
        target_role: targetRole,
        reason: nextSuspendedReason,
      },
    }),
    insertServerNotifications([
      {
        user_id: id,
        type: isSuspending ? "account_suspended" : "account_reactivated",
        title: isSuspending ? "Cuenta suspendida" : "Cuenta reactivada",
        message: isSuspending
          ? `Tu cuenta fue suspendida por administración. Motivo: ${nextSuspendedReason}`
          : "Tu cuenta ha sido reactivada por administración. Ya puedes iniciar sesión normalmente.",
        link: "/login",
      },
    ]),
  ]);

  return NextResponse.json({ ok: true, suspended_at: nextSuspendedAt });
}
