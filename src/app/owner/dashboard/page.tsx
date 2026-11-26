"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Timeline from "@/components/ui/Timeline";
import { Home, Key, CheckCircle, ClipboardList, Clock, FileText, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function OwnerDashboardPage() {
  const supabase = createClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ownerDashboard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: props } = await supabase.from("properties").select("*").eq("owner_id", user.id);
      const propsList = props || [];
      const published = propsList.filter((p: any) => p.status === "published").length;
      const rented = propsList.filter((p: any) => p.status === "rented").length;
      const available = propsList.filter((p: any) => p.status === "published" || p.status === "draft").length;
      const ids = propsList.map((p: any) => p.id);
      const { data: reqs } = ids.length ? await supabase.from("rental_requests").select("*").in("property_id", ids) : { data: [] };
      const reqList = reqs || [];
      const pending = reqList.filter((r: any) => r.status === "pending" || r.status === "docs_submitted").length;
      const { data: cons } = ids.length ? await supabase.from("contracts").select("*").in("property_id", ids) : { data: [] };
      const conList = cons || [];
      const activeContracts = conList.filter((c: any) => c.status === "active").length;
      const now = new Date();
      const soon = conList.filter((c: any) => c.status === "active" && c.end_date && (new Date(c.end_date).getTime() - now.getTime()) / 86400000 <= 30).length;

      const byStatus: Record<string, number> = {};
      for (const r of reqList) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      const chartData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));

      const { data: notifs } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

      return { stats: { published, rented, available, received: reqList.length, pending, activeContracts, soon }, chartData, activity: (notifs || []).slice(0, 10) };
    },
  });

  const stats: any = data?.stats || {};
  const chartData: any[] = data?.chartData || [];
  const activity = data?.activity || [];

  const cards = [
    { label: "Propiedades publicadas", value: stats.published ?? 0, Icon: Home },
    { label: "Propiedades alquiladas", value: stats.rented ?? 0, Icon: Key },
    { label: "Propiedades disponibles", value: stats.available ?? 0, Icon: CheckCircle },
    { label: "Solicitudes recibidas", value: stats.received ?? 0, Icon: ClipboardList },
    { label: "Solicitudes pendientes", value: stats.pending ?? 0, Icon: Clock },
    { label: "Contratos activos", value: stats.activeContracts ?? 0, Icon: FileText },
    { label: "Contratos por vencer", value: stats.soon ?? 0, Icon: AlertTriangle },
  ];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Panel de control</h1>
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />)}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="relative rounded-xl border border-border bg-white p-4 shadow-sm">
              <c.Icon className="absolute right-3 top-3 h-5 w-5 text-primary" />
              <p className="text-xs text-muted">{c.label}</p>
              <p className="text-3xl font-bold text-green-700">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Solicitudes por estado</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#367C59" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Actividad reciente</h2>
          {activity.length === 0 ? (
            <p className="text-muted text-sm">Sin actividad.</p>
          ) : (
            <Timeline items={activity.map((a: any) => ({ title: a.title, message: a.message, at: a.created_at }))} />
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/owner/properties/new-wizard" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Publicar inmueble</Link>
        <Link href="/owner/requests" className="rounded-lg border border-border px-4 py-2 text-sm">Solicitudes pendientes</Link>
        <Link href="/owner/documents" className="rounded-lg border border-border px-4 py-2 text-sm">Revisar documentos</Link>
        <Link href="/owner/contracts" className="rounded-lg border border-border px-4 py-2 text-sm">Consultar contratos</Link>
        <Link href="/owner/calendar" className="rounded-lg border border-border px-4 py-2 text-sm">Abrir calendario</Link>
      </div>
    </div>
  );
}
