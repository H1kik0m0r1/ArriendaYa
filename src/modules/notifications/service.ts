import { isDemoMode, isSupabaseConfigured } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";

export async function syncRenewalReminders(): Promise<void> {
  let supabase: ReturnType<typeof createClient>;
  let user = null;
  try {
    supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return;
    user = data.user;
  } catch {
    return;
  }

  if (isSupabaseConfigured()) {
    await fetch("/api/reminders/check", { method: "POST" }).catch(() => {});
    return;
  }
  if (!isDemoMode()) return;

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*")
    .or(`tenant_id.eq.${user.id},owner_id.eq.${user.id}`)
    .eq("status", "active");
  if (!contracts) return;

  const now = Date.now();
  for (const c of contracts) {
    if (!c.end_date) continue;
    const days = (new Date(c.end_date).getTime() - now) / (1000 * 60 * 60 * 24);
    if (days <= 30 && days > 7 && !c.reminder_month_sent) {
      await supabase.from("contracts").update({ reminder_month_sent: true }).eq("id", c.id);
      await supabase.from("notifications").insert([
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
    }
    if (days <= 7 && days > 0 && !c.reminder_week_sent) {
      await supabase.from("contracts").update({ reminder_week_sent: true }).eq("id", c.id);
      await supabase.from("notifications").insert([
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
    }
  }
}
