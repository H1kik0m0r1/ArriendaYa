import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hasServerNotificationCapability,
  insertServerNotifications,
} from "@/lib/notifications/server-notify";

export async function POST() {
  const auth = await requireApiAuth(["owner", "tenant", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const admin = createAdminClient();
  if (!hasServerNotificationCapability() || !admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para emitir recordatorios de contrato." },
      { status: 503 }
    );
  }

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, owner_id, tenant_id, end_date, reminder_month_sent, reminder_week_sent")
    .or(`tenant_id.eq.${user.id},owner_id.eq.${user.id}`)
    .eq("status", "active");

  if (!contracts || contracts.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const now = Date.now();
  let processed = 0;
  const failures: string[] = [];

  for (const c of contracts) {
    if (!c.end_date) continue;
    const days = (new Date(c.end_date).getTime() - now) / (1000 * 60 * 60 * 24);

    if (days <= 30 && days > 7 && !c.reminder_month_sent) {
      const { data: claimed } = await admin
        .from("contracts")
        .update({ reminder_month_sent: true })
        .eq("id", c.id)
        .eq("reminder_month_sent", false)
        .select("id")
        .maybeSingle();

      if (claimed) {
        const res = await insertServerNotifications([
          {
            user_id: c.owner_id,
            type: "renewal_reminder",
            title: "Renovación próxima",
            message: "Tu contrato vence en menos de un mes. ¿Renovar o suspender?",
            link: `/contracts/${c.id}`,
          },
          {
            user_id: c.tenant_id,
            type: "renewal_reminder",
            title: "Renovación próxima",
            message: "Tu contrato vence en menos de un mes. ¿Renovar o suspender?",
            link: `/contracts/${c.id}`,
          },
        ]);
        if (!res.ok) {
          const { error: revertErr } = await admin
            .from("contracts")
            .update({ reminder_month_sent: false })
            .eq("id", c.id);
          if (revertErr) {
            console.error("[reminders/check] Error revirtiendo reminder_month_sent:", revertErr.message);
            failures.push(`${c.id}: ${res.error} (reversión fallida: ${revertErr.message})`);
          } else {
            failures.push(`${c.id}: ${res.error}`);
          }
          continue;
        }
        processed++;
      }
    }

    if (days <= 7 && days > 0 && !c.reminder_week_sent) {
      const { data: claimed } = await admin
        .from("contracts")
        .update({ reminder_week_sent: true })
        .eq("id", c.id)
        .eq("reminder_week_sent", false)
        .select("id")
        .maybeSingle();

      if (claimed) {
        const res = await insertServerNotifications([
          {
            user_id: c.owner_id,
            type: "renewal_reminder",
            title: "Renovación próxima (1 semana)",
            message: "Tu contrato vence en menos de una semana.",
            link: `/contracts/${c.id}`,
          },
          {
            user_id: c.tenant_id,
            type: "renewal_reminder",
            title: "Renovación próxima (1 semana)",
            message: "Tu contrato vence en menos de una semana.",
            link: `/contracts/${c.id}`,
          },
        ]);
        if (!res.ok) {
          const { error: revertErr } = await admin
            .from("contracts")
            .update({ reminder_week_sent: false })
            .eq("id", c.id);
          if (revertErr) {
            console.error("[reminders/check] Error revirtiendo reminder_week_sent:", revertErr.message);
            failures.push(`${c.id}: ${res.error} (reversión fallida: ${revertErr.message})`);
          } else {
            failures.push(`${c.id}: ${res.error}`);
          }
          continue;
        }
        processed++;
      }
    }
  }

  if (failures.length > 0) {
    return NextResponse.json({ error: failures.join("; "), processed, failed: failures.length }, { status: 502 });
  }

  return NextResponse.json({ processed });
}
