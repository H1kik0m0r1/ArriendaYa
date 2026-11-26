import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { contractLifecycleSchema } from "@/lib/validators/schemas";
import {
  hasServerNotificationCapability,
  insertServerNotifications,
} from "@/lib/notifications/server-notify";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = contractLifecycleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  if (!hasServerNotificationCapability()) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para notificar cambios del contrato." },
      { status: 503 }
    );
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, owner_id, tenant_id, property_id, end_date, status, reminder_month_sent, reminder_week_sent")
    .eq("id", id)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }
  if (contract.owner_id !== user.id && profile.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (contract.status !== "active" && contract.status !== "expiring") {
    return NextResponse.json({ error: "Solo contratos activos pueden renovarse o suspenderse" }, { status: 409 });
  }

  if (parsed.data.action === "renew") {
    const baseDate = contract.end_date ? new Date(contract.end_date) : new Date();
    baseDate.setMonth(baseDate.getMonth() + 12);
    const newEnd = baseDate.toISOString().slice(0, 10);

    const { error } = await supabase
      .from("contracts")
      .update({
        end_date: newEnd,
        reminder_month_sent: false,
        reminder_week_sent: false,
        status: "active",
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const notifRes = await insertServerNotifications([
      {
        user_id: contract.tenant_id,
        type: "contract_renewed",
        title: "Contrato renovado",
        message: `Tu contrato fue renovado hasta ${newEnd}.`,
        link: `/contracts/${contract.id}`,
      },
    ]);
    if (!notifRes.ok) {
      const rollbackClient = createAdminClient() ?? supabase;
      const { error: rollbackErr } = await rollbackClient
        .from("contracts")
        .update({
          end_date: contract.end_date,
          reminder_month_sent: contract.reminder_month_sent,
          reminder_week_sent: contract.reminder_week_sent,
          status: contract.status,
        })
        .eq("id", id);

      if (rollbackErr) {
        console.error("[contracts/lifecycle] Error revirtiendo renovación:", rollbackErr.message);
        return NextResponse.json(
          {
            error: `Falló la notificación (${notifRes.error}) y tampoco se pudo revertir la renovación (${rollbackErr.message}).`,
            rolledBack: false,
          },
          { status: 502 }
        );
      }

      return NextResponse.json({ error: notifRes.error, rolledBack: true }, { status: 502 });
    }

    return NextResponse.json({ ok: true, endDate: newEnd });
  }

  const { error: suspErr } = await supabase
    .from("contracts")
    .update({ status: "suspended" })
    .eq("id", id);
  if (suspErr) return NextResponse.json({ error: suspErr.message }, { status: 400 });

  const { error: propErr } = await supabase
    .from("properties")
    .update({ status: "published" })
    .eq("id", contract.property_id);

  if (propErr) {
    const rollbackClient = createAdminClient() ?? supabase;
    const { error: rbErr } = await rollbackClient.from("contracts").update({ status: contract.status }).eq("id", id);
    if (rbErr) {
      console.error("[contracts/lifecycle] Error revirtiendo suspensión tras fallo en inmueble:", rbErr.message);
    }
    return NextResponse.json(
      { error: rbErr ? `${propErr.message} (falló reversión del contrato: ${rbErr.message})` : propErr.message, rolledBack: !rbErr },
      { status: 400 }
    );
  }

  const notifRes = await insertServerNotifications([
    {
      user_id: contract.tenant_id,
      type: "contract_suspended",
      title: "Contrato suspendido",
      message: "El propietario ha suspendido el contrato.",
      link: `/contracts/${contract.id}`,
    },
  ]);

  if (!notifRes.ok) {
    const rollbackClient = createAdminClient() ?? supabase;
    const { error: propRbErr } = await rollbackClient.from("properties").update({ status: "rented" }).eq("id", contract.property_id);
    const { error: conRbErr } = await rollbackClient.from("contracts").update({ status: contract.status }).eq("id", id);
    if (propRbErr || conRbErr) {
      console.error("[contracts/lifecycle] Error revirtiendo suspensión:", propRbErr?.message, conRbErr?.message);
      return NextResponse.json(
        {
          error: `Falló la notificación (${notifRes.error}) y la reversión fue incompleta.`,
          rolledBack: false,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: notifRes.error, rolledBack: true }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
