"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, Bell, Check, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  listUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/modules/notifications/repository";
import type { Notification } from "@/modules/notifications/types";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export default function NotificationsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        setItems(await listUserNotifications(user.id));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markRead = async (id: string) => {
    const { error } = await markNotificationAsRead(id);
    if (!error) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const markAllRead = async () => {
    if (!userId) return;
    setMarkingAll(true);
    const { error } = await markAllNotificationsAsRead(userId);
    setMarkingAll(false);
    if (!error) {
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;
  const visibleItems = filter === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Notificaciones"
        subtitle="Mantente al día con tus solicitudes, contratos y alertas del sistema."
        actions={
          unreadCount > 0 ? (
            <Button type="button" size="sm" variant="secondary" loading={markingAll} onClick={() => void markAllRead()}>
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span>Marcar todas como leídas ({unreadCount})</span>
            </Button>
          ) : undefined
        }
      />

      {!loading && items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={filter === "all" ? "primary" : "secondary"}
            onClick={() => setFilter("all")}
          >
            Todas ({items.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "unread" ? "primary" : "secondary"}
            onClick={() => setFilter("unread")}
          >
            No leídas ({unreadCount})
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card/70" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title={filter === "unread" ? "No tienes notificaciones sin leer" : "Sin notificaciones"}
          message={filter === "unread" ? "Estás al día con todos tus avisos." : "No tienes avisos pendientes por revisar."}
          icon={<Bell className="h-6 w-6 text-primary" aria-hidden="true" />}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleItems.map((n) => (
            <li key={n.id}>
              <Card className={n.read ? "opacity-75" : "border-primary/40"}>
                <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-primary-dark">{n.title}</p>
                      {!n.read && <Badge color="green">Nueva</Badge>}
                    </div>
                    <p className="text-sm text-foreground">{n.message}</p>
                    <p className="text-xs text-muted">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </p>
                    {n.link && (
                      <Link
                        href={n.link}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <span>Ver detalle</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                  {!n.read && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void markRead(n.id)}
                      className="shrink-0 self-start"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Marcar leída</span>
                    </Button>
                  )}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
