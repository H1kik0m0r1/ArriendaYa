import { NextResponse } from "next/server";
import { isMissingColumnError, requireAdminService } from "@/lib/admin/server-helpers";
import { recordAuditEvent } from "@/lib/audit/server-audit";
import { insertServerNotifications } from "@/lib/notifications/server-notify";
import { propertyModerationSchema } from "@/modules/admin/schemas";

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
  const parsed = propertyModerationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos inválidos" },
      { status: 400 }
    );
  }

  const { data: propRaw, error: propErr } = await admin
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (propErr) {
    return NextResponse.json({ error: propErr.message }, { status: 400 });
  }
  if (!propRaw) {
    return NextResponse.json({ error: "Inmueble no encontrado" }, { status: 404 });
  }

  const prop = propRaw as Record<string, unknown>;
  const propName = String(prop.name || "Inmueble");
  const ownerId = String(prop.owner_id);
  const realStatus = String(prop.status || "");

  const nextModerationStatus =
    parsed.data.action === "pause"
      ? "paused_by_admin"
      : parsed.data.action === "suspend"
      ? "suspended"
      : "active";

  const isRestoring = parsed.data.action === "restore";
  const reason = isRestoring ? null : (parsed.data.reason || "").trim();

  // Nunca modificamos `status` ni contratos: solo campos de moderacion administrativa
  const { error: updateErr } = await admin
    .from("properties")
    .update({
      moderation_status: nextModerationStatus,
      moderation_reason: reason,
      moderated_at: isRestoring ? null : new Date().toISOString(),
      moderated_by: isRestoring ? null : user.id,
    })
    .eq("id", id);

  if (updateErr) {
    if (isMissingColumnError(updateErr)) {
      return NextResponse.json(
        { error: "Falta ejecutar la migración 0006_admin_panel.sql en Supabase para moderar inmuebles." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  await Promise.all([
    recordAuditEvent({
      actorId: user.id,
      action: `admin.property_${parsed.data.action}`,
      entity: "properties",
      targetType: "property",
      targetId: id,
      result: "success",
      details: {
        property_name: propName,
        owner_id: ownerId,
        preserved_status: realStatus,
        moderation_status: nextModerationStatus,
        reason,
      },
    }),
    insertServerNotifications([
      {
        user_id: ownerId,
        type: "property_moderation",
        title: isRestoring
          ? `Inmueble restaurado: ${propName}`
          : `Inmueble ${parsed.data.action === "pause" ? "pausado" : "suspendido"} por administración`,
        message: isRestoring
          ? `El inmueble "${propName}" vuelve a estar habilitado para el catálogo público.`
          : `El inmueble "${propName}" fue ocultado del catálogo público sin afectar contratos ni historial. Motivo: ${reason}`,
        link: "/owner/properties",
      },
    ]),
  ]);

  return NextResponse.json({ ok: true, moderation_status: nextModerationStatus });
}
