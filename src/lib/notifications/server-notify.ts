import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface NotificationInput {
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}

export type ServerNotifyResult =
  | { ok: true }
  | { ok: false; code: "MISSING_SERVICE_KEY" | "INSERT_FAILED"; error: string };

export function hasServerNotificationCapability(): boolean {
  return Boolean(createAdminClient());
}

/**
 * Inserta notificaciones para terceros exclusivamente desde el servidor.
 * Nunca falla en silencio si falta SUPABASE_SERVICE_ROLE_KEY o falla la insercion.
 */
export async function insertServerNotifications(
  items: NotificationInput[]
): Promise<ServerNotifyResult> {
  if (!items.length) return { ok: true };
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      code: "MISSING_SERVICE_KEY",
      error: "Falta SUPABASE_SERVICE_ROLE_KEY para enviar notificaciones entre usuarios.",
    };
  }
  const { error } = await admin.from("notifications").insert(
    items.map((item) => ({
      user_id: item.user_id,
      type: item.type,
      title: item.title,
      message: item.message,
      link: item.link ?? null,
    }))
  );
  if (error) {
    return {
      ok: false,
      code: "INSERT_FAILED",
      error: error.message,
    };
  }
  return { ok: true };
}
