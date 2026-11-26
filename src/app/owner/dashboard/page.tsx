"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, ClipboardList, Clock, FileText, Home, Key } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchOwnerDashboardData } from "@/modules/analytics/service";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Timeline from "@/components/ui/Timeline";

export default function OwnerDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ownerDashboard"],
    queryFn: fetchOwnerDashboardData,
  });

  const stats = data?.stats ?? {
    published: 0,
    rented: 0,
    available: 0,
    received: 0,
    pending: 0,
    activeContracts: 0,
    soon: 0,
  };
  const chartData = data?.chartData ?? [];
  const activity = data?.activity ?? [];

  const cards = [
    { label: "Propiedades publicadas", value: stats.published, Icon: Home },
    { label: "Propiedades alquiladas", value: stats.rented, Icon: Key },
    { label: "Propiedades disponibles", value: stats.available, Icon: CheckCircle },
    { label: "Solicitudes recibidas", value: stats.received, Icon: ClipboardList },
    { label: "Solicitudes pendientes", value: stats.pending, Icon: Clock },
    { label: "Contratos activos", value: stats.activeContracts, Icon: FileText },
    { label: "Contratos por vencer", value: stats.soon, Icon: AlertTriangle },
  ];

  return (
    <div>
      <PageHeader
        title="Panel de control"
        subtitle="Resumen general de tus propiedades, solicitudes y contratos activos."
        actions={
          <Link
            href="/owner/properties/new-wizard"
            className="rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white hover:bg-primary-btn-hover"
          >
            Publicar inmueble
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-secondary" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="relative rounded-2xl border border-border bg-card p-4 shadow-sm">
              <c.Icon className="absolute right-3.5 top-3.5 h-5 w-5 text-primary" aria-hidden="true" />
              <p className="pr-6 text-xs font-medium text-muted">{c.label}</p>
              <p className="mt-1 text-3xl font-bold text-primary-dark">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <h2 className="mb-3 font-semibold text-foreground">Solicitudes por estado</h2>
          {chartData.length === 0 ? (
            <EmptyState
              title="Sin solicitudes todavía"
              message="Cuando recibas solicitudes aparecerá aquí la distribución por estado."
            />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#367C59" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <h2 className="mb-3 font-semibold text-foreground">Actividad reciente</h2>
          {activity.length === 0 ? (
            <EmptyState
              title="Sin actividad reciente"
              message="Las novedades de tus inmuebles y contratos aparecerán aquí."
            />
          ) : (
            <Timeline items={activity.map((a) => ({ title: a.title, message: a.message, at: a.created_at }))} />
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/owner/requests" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/10">
          Solicitudes pendientes
        </Link>
        <Link href="/owner/documents" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/10">
          Revisar documentos
        </Link>
        <Link href="/owner/contracts" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/10">
          Consultar contratos
        </Link>
        <Link href="/owner/calendar" className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/10">
          Abrir calendario
        </Link>
      </div>
    </div>
  );
}
