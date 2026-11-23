"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReminderChecker() {
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: contracts } = await supabase
        .from("contracts")
        .select("*")
        .or(`tenant_id.eq.${user.id},owner_id.eq.${user.id}`)
        .eq("status", "active");
      if (!contracts) return;
      const now = new Date();
      for (const c of contracts) {
        if (!c.end_date) continue;
        const end = new Date(c.end_date);
        const days = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        const otherUserId = user.id === c.owner_id ? c.tenant_id : c.owner_id;
        // month before
        if (days <= 30 && days > 7 && !c.reminder_month_sent) {
          await supabase.from("contracts").update({ reminder_month_sent: true }).eq("id", c.id);
          await supabase.from("notifications").insert([
            { user_id: c.owner_id, type: "renewal_reminder", title: "Renovación próxima", message: "Tu contrato vence en menos de un mes. ¿Renovar o suspender?", link: `/contracts/${c.id}` },
            { user_id: c.tenant_id, type: "renewal_reminder", title: "Renovación próxima", message: "Tu contrato vence en menos de un mes. ¿Renovar o suspender?", link: `/contracts/${c.id}` },
          ]);
        }
        // week before
        if (days <= 7 && days > 0 && !c.reminder_week_sent) {
          await supabase.from("contracts").update({ reminder_week_sent: true }).eq("id", c.id);
          await supabase.from("notifications").insert([
            { user_id: c.owner_id, type: "renewal_reminder", title: "Renovación próxima (1 semana)", message: "Tu contrato vence en menos de una semana.", link: `/contracts/${c.id}` },
            { user_id: c.tenant_id, type: "renewal_reminder", title: "Renovación próxima (1 semana)", message: "Tu contrato vence en menos de una semana.", link: `/contracts/${c.id}` },
          ]);
        }
      }
    })();
  }, []);
  return null;
}
