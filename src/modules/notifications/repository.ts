import { createClient } from "@/lib/supabase/client";
import type { Notification } from "./types";

export async function listUserNotifications(userId: string): Promise<Notification[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as Notification[] | null) ?? [];
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

export async function markNotificationAsRead(notificationId: string) {
  const supabase = createClient();
  return supabase.from("notifications").update({ read: true }).eq("id", notificationId);
}

export async function markAllNotificationsAsRead(userId: string) {
  const supabase = createClient();
  return supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}
