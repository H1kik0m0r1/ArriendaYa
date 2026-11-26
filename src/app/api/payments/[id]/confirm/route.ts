import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { paymentConfirmSchema } from "@/lib/validators/schemas";
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
  const parsed = paymentConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado de pago inválido" }, { status: 400 });
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount, concept, status, tenant_id, contract:contracts(id, owner_id)")
    .eq("id", id)
    .single();

  const ownerId = (payment?.contract as { owner_id?: string } | null)?.owner_id;
  if (!payment || (ownerId !== user.id && profile.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado para confirmar este pago" }, { status: 403 });
  }
  if (payment.status === "confirmado") {
    return NextResponse.json({ error: "El pago ya fue confirmado y no puede modificarse" }, { status: 409 });
  }
  if (payment.tenant_id && !hasServerNotificationCapability()) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para notificar la confirmación del pago." },
      { status: 503 }
    );
  }

  const previousStatus = payment.status;
  const { error } = await supabase
    .from("payments")
    .update({ status: parsed.data.status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (payment.tenant_id) {
    const notifRes = await insertServerNotifications([
      {
        user_id: payment.tenant_id,
        type: "payment_status_changed",
        title: parsed.data.status === "confirmado" ? "Pago confirmado" : "Pago rechazado",
        message: `${payment.concept || "Pago"} ($${Number(payment.amount).toLocaleString("es-CO")}) fue marcado como ${parsed.data.status}.`,
        link: "/tenant/finances",
      },
    ]);
    if (!notifRes.ok) {
      const rollbackClient = createAdminClient() ?? supabase;
      await rollbackClient.from("payments").update({ status: previousStatus }).eq("id", id);
      return NextResponse.json({ error: notifRes.error }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, status: parsed.data.status });
}
