import { NextResponse } from "next/server";
import { isMissingColumnError } from "@/lib/admin/server-helpers";
import { recordAuditEvent } from "@/lib/audit/server-audit";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { insertServerNotifications } from "@/lib/notifications/server-notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminReportUpdateSchema } from "@/modules/admin/schemas";
import { reportResponseSchema } from "@/modules/reports/schemas";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);

  if (profile.role === "admin") {
    const adminParsed = adminReportUpdateSchema.safeParse(body);
    if (!adminParsed.success) {
      return NextResponse.json(
        { error: adminParsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("reports")
      .select("id, reporter_id, reason, status, response")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
    }

    const nextStatus =
      adminParsed.data.status || (adminParsed.data.response ? "respondido" : existing.status || "en_revision");
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    };
    if (adminParsed.data.response && adminParsed.data.response.length > 0) {
      updatePayload.response = adminParsed.data.response;
    }

    let { error } = await supabase.from("reports").update(updatePayload).eq("id", id);
    if (error && isMissingColumnError(error)) {
      const legacyPayload: Record<string, unknown> = { status: nextStatus };
      if (adminParsed.data.response) legacyPayload.response = adminParsed.data.response;
      const retry = await supabase.from("reports").update(legacyPayload).eq("id", id);
      error = retry.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await recordAuditEvent({
      actorId: user.id,
      action: "admin.report_updated",
      entity: "reports",
      targetType: "report",
      targetId: id,
      result: "success",
      details: {
        previous_status: existing.status,
        new_status: nextStatus,
        has_response: Boolean(adminParsed.data.response),
      },
    });

    if (existing.reporter_id) {
      await insertServerNotifications([
        {
          user_id: existing.reporter_id,
          type: "report_updated",
          title: `Actualización de reporte (${nextStatus})`,
          message:
            adminParsed.data.response ||
            `Tu reporte "${existing.reason || "Soporte"}" cambió al estado "${nextStatus}".`,
          link: "/notifications",
        },
      ]);
    }

    return NextResponse.json({ ok: true });
  }

  const parsed = reportResponseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Respuesta inválida" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para gestionar respuestas de reportes de inmuebles." },
      { status: 503 }
    );
  }

  const { data: report } = await admin
    .from("reports")
    .select("id, target_type, target_id")
    .eq("id", id)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
  }
  if (report.target_type !== "property" || !report.target_id) {
    return NextResponse.json({ error: "Solo un administrador puede responder reportes de plataforma" }, { status: 403 });
  }

  const { data: prop } = await admin
    .from("properties")
    .select("id, owner_id")
    .eq("id", report.target_id)
    .maybeSingle();

  if (!prop || prop.owner_id !== user.id) {
    return NextResponse.json({ error: "No autorizado para responder este reporte" }, { status: 403 });
  }

  const { error } = await admin
    .from("reports")
    .update({ response: parsed.data.response, status: "respondido" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
