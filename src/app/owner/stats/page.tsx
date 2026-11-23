"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function StatsPage() {
  const supabase = createClient();
  const [visits, setVisits] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [conversion, setConversion] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: props } = await supabase.from("properties").select("*").eq("owner_id", user.id);
      const list = props || [];
      setVisits(list.map((p: any) => ({ name: p.name, visitas: p.visits || 0, guardados: 0 })));
      const ids = list.map((p: any) => p.id);
      if (!ids.length) return;
      const { data: reqs } = await supabase.from("rental_requests").select("*").in("property_id", ids);
      const byProp: Record<string, number> = {};
      for (const r of reqs || []) byProp[r.property_id] = (byProp[r.property_id] || 0) + 1;
      setRequests(list.map((p: any) => ({ name: p.name, solicitudes: byProp[p.id] || 0 })));
      const total = (reqs || []).length;
      const accepted = (reqs || []).filter((r: any) => r.status === "accepted").length;
      const rejected = (reqs || []).filter((r: any) => r.status === "rejected").length;
      setConversion([
        { name: "Aceptadas", value: accepted },
        { name: "Rechazadas", value: rejected },
        { name: "Otras", value: total - accepted - rejected },
      ]);
    })();
  }, [supabase]);

  const COLORS = ["#4caf50", "#ef4444", "#9ca3af"];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Estadísticas y reportes</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Visitas por inmueble</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visits}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="visitas" fill="#4caf50" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Solicitudes por propiedad</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={requests}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="solicitudes" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Aceptadas vs rechazadas</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={conversion} dataKey="value" nameKey="name" outerRadius={70}>
                  {conversion.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
