"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  FileCheck2,
  FileSearch,
  FileText,
  FileWarning,
  Heart,
  Home,
  Inbox,
  MessageSquare,
} from "lucide-react";
import { fetchTenantDashboardData } from "@/modules/analytics/service";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export default function TenantDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["tenantDashboard"],
    queryFn: fetchTenantDashboardData,
  });

  const stats = data?.stats ?? {
    total: 0,
    pending: 0,
    inReview: 0,
    active: 0,
    soon: 0,
    docsPending: 0,
  };
  const activity = data?.activity ?? [];

  const cards = [
    { label: "Solicitudes realizadas", value: stats.total, icon: FileText, tone: "text-primary bg-primary/10" },
    { label: "Pendientes de respuesta", value: stats.pending, icon: Clock, tone: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/60" },
    { label: "En verificación documental", value: stats.inReview, icon: FileSearch, tone: "text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/60" },
    { label: "Contratos activos", value: stats.active, icon: FileCheck2, tone: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/60" },
    { label: "Contratos por vencer", value: stats.soon, icon: FileWarning, tone: "text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-950/60" },
    { label: "Documentos pendientes", value: stats.docsPending, icon: Inbox, tone: "text-foreground bg-surface-secondary" },
  ];

  const quickLinks = [
    { href: "/", label: "Buscar inmuebles", icon: Home, primary: true },
    { href: "/tenant/requests", label: "Mis solicitudes", icon: FileText },
    { href: "/tenant/documents", label: "Mis documentos", icon: FileSearch },
    { href: "/tenant/contracts", label: "Mis contratos", icon: FileCheck2 },
    { href: "/tenant/saved", label: "Favoritos", icon: Heart },
    { href: "/tenant/messages", label: "Mensajes", icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel principal"
        subtitle="Resumen de tus solicitudes, contratos activos y actividad reciente."
        actions={
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-btn-hover"
          >
            Explorar propiedades
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface-secondary" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.label}>
                <CardBody className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted">{c.label}</p>
                    <p className="mt-1 text-3xl font-bold text-primary-dark">{c.value}</p>
                  </div>
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.tone}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-primary-dark">Actividad reciente</h2>
          </CardHeader>
          <CardBody>
            {activity.length === 0 ? (
              <EmptyState
                title="Sin actividad reciente"
                message="Cuando envíes solicitudes o recibas novedades aparecerán aquí."
              />
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-4">
                {activity.map((a) => (
                  <li key={a.id} className="ml-2">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <p className="text-xs text-muted">{a.message}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-primary-dark">Accesos rápidos</h2>
          </CardHeader>
          <CardBody>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className={`flex min-h-[42px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      item.primary
                        ? "bg-primary-btn text-white hover:bg-primary-btn-hover"
                        : "border border-border bg-card text-foreground hover:bg-primary-light/60"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
