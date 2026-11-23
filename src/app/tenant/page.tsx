"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function TenantDashboardPage() {
  const supabase = createClient();
  const { data, isLoading } = useQuery({
    queryKey: ["tenantDashboard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: reqs } = await supabase.from("rental_requests").select("*").eq("tenant_id", user.id);
      const r = reqs || [];
      const pending = r.filter((x: any) => x.status === "pending").length;
      const inReview = r.filter((x: any) => x.status === "docs_submitted" || x.status === "returned").length;
      const { data: cons } = await supabase.from("contracts").select("*").eq("tenant_id", user.id);
      const c = cons || [];
      const active = c.filter((x: any) => x.status === "active").length;
      const now = new Date();
      const soon = c.filter((x: any) => x.status === "active" && x.end_date && (new Date(x.end_date).getTime() - now.getTime()) / 86400000 <= 30).length;
      const docsPending = r.filter((x: any) => x.status === "first_accepted" || x.status === "returned").length;
      const { data: notifs } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return { stats: { total: r.length, pending, inReview, active, soon, docsPending }, activity: (notifs || []).slice(0, 10) };
    },
  });

  const stats: any = data?.stats || {};
  const activity: any[] = data?.activity || [];

  const cards = [
    { label: "Solicitudes realizadas", value: stats.total ?? 0, icon: "📋" },
    { label: "Pendientes de respuesta", value: stats.pending ?? 0, icon: "⏳" },
    { label: "En verificación documental", value: stats.inReview ?? 0, icon: "🔍" },
    { label: "Contratos activos", value: stats.active ?? 0, icon: "📝" },
    { label: "Contratos por vencer", value: stats.soon ?? 0, icon: "⏰" },
    { label: "Documentos pendientes", value: stats.docsPending ?? 0, icon: "📄" },
  ];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Panel principal</h1>
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="relative rounded-xl border border-border bg-white p-4 shadow-sm">
              <span className="absolute right-3 top-3 text-xl">{c.icon}</span>
              <p className="text-xs text-muted">{c.label}</p>
              <p className="text-3xl font-bold text-green-700">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Actividad reciente</h2>
          {activity.length === 0 ? (
            <p className="text-muted text-sm">Sin actividad.</p>
          ) : (
            <ol className="relative border-l border-border pl-4">
              {activity.map((a) => (
                <li key={a.id} className="mb-4 ml-2">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted">{a.message}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Accesos rápidos</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="rounded-lg bg-primary px-3 py-1 text-sm text-white">Buscar inmuebles</Link>
            <Link href="/tenant/requests" className="rounded-lg border border-border px-3 py-1 text-sm">Mis solicitudes</Link>
            <Link href="/tenant/requests" className="rounded-lg border border-border px-3 py-1 text-sm">Entregar docs</Link>
            <Link href="/tenant/contracts" className="rounded-lg border border-border px-3 py-1 text-sm">Mis contratos</Link>
            <Link href="/tenant/saved" className="rounded-lg border border-border px-3 py-1 text-sm">Favoritos</Link>
            <Link href="/owner/messages" className="rounded-lg border border-border px-3 py-1 text-sm">Mensajes</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
