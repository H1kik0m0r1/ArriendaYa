"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAdminOverview } from "@/modules/admin/service";
import type { AdminOverviewData } from "@/modules/admin/types";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

const STATUS_LABELS: Record<string, string> = {
  published: "Publicados",
  rented: "Alquilados",
  draft: "Borradores",
  paused: "Pausados",
  maintenance: "Mantenimiento",
  archived: "Archivados",
  pending: "Pendientes",
  first_accepted: "Pre-aprobadas",
  docs_submitted: "Con docs",
  returned: "Devueltas",
  accepted: "Aceptadas",
  rejected: "Rechazadas",
  property_rented: "Arrendadas",
  withdrawn: "Retiradas",
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetchAdminOverview();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const stats = data?.stats;

  const kpiCards = stats
    ? [
        {
          label: "Usuarios registrados",
          value: stats.usersTotal,
          sub: `${stats.ownersCount} propietarios · ${stats.tenantsCount} inquilinos · ${stats.adminsCount} admin`,
          Icon: Users,
        },
        {
          label: "Cuentas suspendidas",
          value: stats.suspendedUsersCount,
          sub: `${stats.pendingInvitations} invitaciones pendientes`,
          Icon: ShieldAlert,
        },
        {
          label: "Inmuebles totales",
          value: stats.propertiesTotal,
          sub: `${stats.publishedProperties} publicados · ${stats.rentedProperties} alquilados · ${stats.moderatedProperties} moderados`,
          Icon: Building2,
        },
        {
          label: "Solicitudes activas",
          value: stats.activeRequests,
          sub: `${stats.activeContracts} contratos vigentes · ${stats.pendingVisits} visitas solicitadas`,
          Icon: FileText,
        },
        {
          label: "Reportes por atender",
          value: stats.pendingReports,
          sub: `${stats.pendingVerifications} verificaciones pendientes`,
          Icon: AlertTriangle,
        },
        {
          label: "Pendientes / pausados",
          value: stats.pendingOrPausedProperties,
          sub: "Inmuebles en borrador, pausa o mantenimiento",
          Icon: ClipboardCheck,
        },
      ]
    : [];

  const propertyChart = (data?.propertiesByStatus ?? []).map((item) => ({
    name: STATUS_LABELS[item.name] || item.name,
    cantidad: item.value,
  }));

  const requestChart = (data?.requestsByStatus ?? []).map((item) => ({
    name: STATUS_LABELS[item.name] || item.name,
    cantidad: item.value,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel administrativo"
        subtitle="Supervisión operativa, cuentas, moderación de inmuebles, reportes y auditoría en tiempo real."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/users"
              className="inline-flex min-h-[38px] items-center rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary"
            >
              Gestionar usuarios
            </Link>
            <Link
              href="/admin/properties"
              className="inline-flex min-h-[38px] items-center rounded-lg bg-primary-btn px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-btn-hover"
            >
              Moderar inmuebles
            </Link>
          </div>
        }
      />

      {data && !data.migrationReady && (
        <Alert variant="warning" title="Migración 0006 pendiente en Supabase">
          Ejecuta <code>supabase/migrations/0006_admin_panel.sql</code> en el SQL Editor de Supabase para habilitar suspensión en base de datos, moderación administrativa y auditoría inmutable.
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-2xl border border-border bg-surface-secondary" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="error" title="No se pudieron cargar las métricas administrativas">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kpiCards.map(({ label, value, sub, Icon }) => (
              <div
                key={label}
                className="relative rounded-2xl border border-border bg-card p-4 shadow-xs"
              >
                <Icon className="absolute right-3.5 top-3.5 h-5 w-5 text-primary" aria-hidden="true" />
                <p className="pr-7 text-xs font-medium text-muted">{label}</p>
                <p className="mt-1 text-2xl font-bold text-primary-dark">{value}</p>
                <p className="mt-1 text-xs text-muted">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="font-semibold text-foreground">Inmuebles por estado</h2>
              </CardHeader>
              <CardBody className="min-w-0">
                {propertyChart.length === 0 ? (
                  <EmptyState
                    title="Sin inmuebles registrados"
                    message="No hay inmuebles cargados en la plataforma todavía."
                  />
                ) : (
                  <div className="h-60 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={propertyChart}>
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="cantidad" fill="#2e7d32" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="font-semibold text-foreground">Solicitudes de alquiler por estado</h2>
              </CardHeader>
              <CardBody className="min-w-0">
                {requestChart.length === 0 ? (
                  <EmptyState
                    title="Sin solicitudes registradas"
                    message="Las solicitudes de alquiler aparecerán aquí conforme se registren."
                  />
                ) : (
                  <div className="h-60 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={requestChart}>
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="cantidad" fill="#1b5e20" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex items-center justify-between gap-2">
                <h2 className="truncate font-semibold text-foreground">Reportes recientes</h2>
                <Link href="/admin/reports" className="shrink-0 text-xs font-medium text-primary hover:underline">
                  Ver todos
                </Link>
              </CardHeader>
              <CardBody className="min-w-0">
                {data && data.recentReports.length === 0 ? (
                  <EmptyState
                    title="Sin reportes recientes"
                    message="No hay reportes pendientes o registrados recientemente."
                  />
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {data?.recentReports.map((r) => (
                      <li key={r.id} className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {r.reason || "Reporte"}{" "}
                            {r.property_name ? `· ${r.property_name}` : ""}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {r.reporter_name || r.reporter_email || "Usuario"} ·{" "}
                            {new Date(r.created_at).toLocaleDateString("es-CO")}
                          </p>
                        </div>
                        <Badge color={r.status === "resuelto" || r.status === "respondido" ? "green" : "yellow"}>
                          {r.status || "pendiente"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="flex items-center justify-between gap-2">
                <h2 className="truncate font-semibold text-foreground">Actividad administrativa reciente</h2>
                <Link href="/admin/audit" className="shrink-0 text-xs font-medium text-primary hover:underline">
                  Ver bitácora
                </Link>
              </CardHeader>
              <CardBody className="min-w-0">
                {data && data.recentAudit.length === 0 ? (
                  <EmptyState
                    title="Bitácora sin eventos aún"
                    message="Las acciones administrativas registradas aparecerán aquí."
                  />
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {data?.recentAudit.map((log) => (
                      <li key={log.id} className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{log.action}</p>
                          <p className="truncate text-xs text-muted">
                            {log.actor_name || log.actor_email || "Sistema"} ·{" "}
                            {new Date(log.created_at).toLocaleString("es-CO")}
                          </p>
                        </div>
                        <Badge color={log.result === "success" ? "green" : "red"}>
                          {log.result}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
