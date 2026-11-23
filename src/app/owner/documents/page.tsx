"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

export default function DocumentsPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: props } = await supabase.from("properties").select("id").eq("owner_id", user.id);
      const ids = (props || []).map((p: any) => p.id);
      if (!ids.length) return;
      const { data: reqs } = await supabase.from("rental_requests").select("*").in("property_id", ids);
      setRequests(reqs || []);
    })();
  }, [supabase]);

  const open = async (r: any) => {
    setSelected(r);
    const { data } = await supabase.from("request_documents").select("*").eq("request_id", r.id);
    setDocs(data || []);
    // build checklist
    const cl: Record<string, string> = {};
    for (const d of data || []) cl[d.doc_type] = d.file_url ? "entregado" : "pendiente";
    setChecklist(cl);
  };

  const verify = async (docId: string, status: string) => {
    await supabase.from("request_documents").update({ status }).eq("id", docId);
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, status } : d)));
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Documentación</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Solicitudes con documentos</h2>
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id}>
                <button onClick={() => open(r)} className="text-sm text-primary hover:underline">
                  Solicitud {r.id.slice(0, 8)} — {r.status}
                </button>
              </li>
            ))}
            {requests.length === 0 && <li className="text-muted text-sm">Sin solicitudes.</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Detalle</h2>
          {!selected && <p className="text-muted text-sm">Selecciona una solicitud.</p>}
          {selected && (
            <div>
              <p className="text-xs text-muted mb-2">Estado: {selected.status}</p>
              <p className="mb-2 text-sm font-medium">Checklist</p>
              <ul className="mb-3 flex flex-col gap-1 text-sm">
                {Object.keys(checklist).length === 0 && <li className="text-muted">Sin documentos.</li>}
                {Object.entries(checklist).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span className={v === "entregado" ? "text-green-600" : "text-red-600"}>{v}</span>
                  </li>
                ))}
              </ul>
              <p className="mb-2 text-sm font-medium">Archivos</p>
              <ul className="flex flex-col gap-2">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{d.doc_type}</a>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => verify(d.id, "aprobado")}>Aprobar</Button>
                      <Button size="sm" variant="danger" onClick={() => verify(d.id, "rechazado")}>Rechazar</Button>
                    </div>
                  </li>
                ))}
              </ul>
              {docs.length > 0 && (
                <p className="mt-3 text-xs text-muted">Completado: {Math.round((docs.filter((d) => d._status === "aprobado").length / docs.length) * 100)}%</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
