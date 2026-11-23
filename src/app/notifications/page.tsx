"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Notification } from "@/lib/types";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setItems((data as Notification[]) || []);
    })();
  }, [supabase]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-primary">Notificaciones</h1>
      {items.length === 0 && <p className="text-muted">No tienes notificaciones.</p>}
      <ul className="flex flex-col gap-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={`rounded-lg border border-border bg-card p-4 ${n.read ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted">{n.message}</p>
                <p className="text-xs text-muted">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                </p>
                {n.link && (
                  <Link href={n.link} className="text-xs text-primary hover:underline">Ir →</Link>
                )}
              </div>
              {!n.read && (
                <button onClick={() => markRead(n.id)} className="text-xs text-primary hover:underline">
                  Marcar leída
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
