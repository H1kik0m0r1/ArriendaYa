"use client";
import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchOwnerStatsData } from "@/modules/analytics/service";
import type { OwnerStatsData } from "@/modules/analytics/types";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

const COLORS = ["#367C59", "#dc2626", "#9ca3af"];

export default function StatsPage() {
  const [stats, setStats] = useState<OwnerStatsData>({
    visits: [],
    requests: [],
    conversion: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchOwnerStatsData().then((d) => {
      setStats(d);
      setLoading(false);
    });
  }, []);

  const hasData = stats.visits.length > 0 || stats.requests.length > 0;

  return (
    <div>
      <PageHeader
        title="Estadísticas"
        subtitle="Visualiza visitas, volumen de solicitudes y tasa de aceptación de tus inmuebles."
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-56 animate-pulse rounded-2xl bg-surface-secondary" />
          <div className="h-56 animate-pulse rounded-2xl bg-surface-secondary" />
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Sin datos para graficar"
          message="Publica al menos una propiedad y recibe visitas o solicitudes para consultar métricas aquí."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <h2 className="mb-2 font-semibold text-foreground">Visitas por inmueble</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.visits}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="visitas" fill="#367C59" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <h2 className="mb-2 font-semibold text-foreground">Solicitudes por propiedad</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.requests}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="solicitudes" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs md:col-span-2">
            <h2 className="mb-2 font-semibold text-foreground">Solicitudes aceptadas vs. rechazadas</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.conversion} dataKey="value" nameKey="name" outerRadius={75}>
                    {stats.conversion.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
