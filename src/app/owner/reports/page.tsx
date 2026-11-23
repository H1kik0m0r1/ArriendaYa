"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

export default function ReportsPage() {
  const supabase = createClient();
  const [reports, setReports] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
    setReports(data || []);
  };

  useEffect(() => { load(); }, [supabase]);

  const respond = async (id: string, resp: string) => {
    await supabase.from("reports").update({ response: resp, status: "respondido" }).eq("id", id);
    load();
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Gestión de reportes</h1>
      {reports.length === 0 && <p className="text-muted">Sin reportes.</p>}
      <ul className="flex flex-col gap-3">
        {reports.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-medium">{r.reason}</p>
            <p className="text-muted">{r.description}</p>
            <p className="text-xs text-muted">Estado: {r.status || "pendiente"}</p>
            {r.response && <p className="text-xs text-green-600">Respuesta: {r.response}</p>}
            {!r.response && (
              <button onClick={() => { const resp = prompt("Respuesta:"); if (resp) respond(r.id, resp); }} className="mt-2 text-primary hover:underline">
                Responder
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
