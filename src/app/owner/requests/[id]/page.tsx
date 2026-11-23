"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RentalRequest, Property } from "@/lib/types";
import { REQUEST_STATUSES } from "@/lib/constants";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

export default function OwnerRequestDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  const [req, setReq] = useState<RentalRequest | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [docs, setDocs] = useState<{ id: string; doc_type: string; file_url: string }[]>([]);
  const [reason, setReason] = useState("");
  const [returnMsg, setReturnMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [obs, setObs] = useState("");
  const [observations, setObservations] = useState<{ text: string; at: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("request_notes").select("*").eq("request_id", id);
      setObservations((data || []).map((n: any) => ({ text: n.text, at: n.created_at })));
    })();
  }, [id, supabase]);

  const load = async () => {
    const { data: r } = await supabase.from("rental_requests").select("*").eq("id", id).single();
    setReq(r as RentalRequest);
    if (r) {
      const { data: p } = await supabase.from("properties").select("*").eq("id", r.property_id).single();
      setProperty(p as Property);
      const { data: d } = await supabase.from("request_documents").select("*").eq("request_id", id);
      setDocs(d || []);
    }
  };

  useEffect(() => { load(); }, [id]);

  const firstAccept = async () => {
    setLoading(true);
    await supabase.from("rental_requests").update({ status: "first_accepted", first_decision_at: new Date().toISOString() }).eq("id", id);
    toast.show("Solicitud aceptada (1er filtro)", "success");
    // notify tenant
    if (req) await supabase.from("notifications").insert({
      user_id: req.tenant_id, type: "request_first_accepted", title: "Solicitud aceptada (1er filtro)",
      message: `Tu solicitud para "${property?.name}" fue aceptada. Ahora sube los documentos requeridos.`,
      link: `/tenant/requests/${id}`,
    });
    await load();
    setLoading(false);
  };

  const firstReject = async () => {
    if (!reason) { alert("Indica el motivo del rechazo."); return; }
    setLoading(true);
    await supabase.from("rental_requests").update({ status: "rejected", rejection_reason: reason, first_decision_at: new Date().toISOString() }).eq("id", id);
    toast.show("Solicitud rechazada", "error");
    if (req) await supabase.from("notifications").insert({
      user_id: req.tenant_id, type: "request_rejected", title: "Solicitud rechazada",
      message: `Tu solicitud para "${property?.name}" fue rechazada: ${reason}`,
      link: `/tenant/requests/${id}`,
    });
    await load();
    setLoading(false);
  };

  const secondAccept = async () => {
    setLoading(true);
    await supabase.from("rental_requests").update({ status: "accepted" }).eq("id", id);
    toast.show("Solicitud aceptada definitivamente. Contrato disponible.", "success");
    // create contract
    if (req && property) {
      await supabase.from("contracts").insert({
        request_id: id,
        property_id: property.id,
        tenant_id: req.tenant_id,
        owner_id: property.owner_id,
        status: "pending_signatures",
      });
      await supabase.from("notifications").insert({
        user_id: req.tenant_id, type: "request_accepted", title: "Solicitud aceptada (2º filtro)",
        message: `Tu solicitud para "${property.name}" fue aceptada. Procede a firmar el contrato.`,
        link: `/tenant/requests/${id}`,
      });
    }
    await load();
    setLoading(false);
  };

  const secondReject = async () => {
    if (!reason) { alert("Indica el motivo del rechazo."); return; }
    setLoading(true);
    await supabase.from("rental_requests").update({ status: "rejected", rejection_reason: reason }).eq("id", id);
    toast.show("Solicitud rechazada", "error");
    if (req) await supabase.from("notifications").insert({
      user_id: req.tenant_id, type: "request_rejected", title: "Solicitud rechazada",
      message: `Tu solicitud para "${property?.name}" fue rechazada: ${reason}`,
      link: `/tenant/requests/${id}`,
    });
    await load();
    setLoading(false);
  };

  const secondReturn = async () => {
    if (!returnMsg) { alert("Indica qué documento falta o el error."); return; }
    setLoading(true);
    await supabase.from("rental_requests").update({ status: "returned", return_message: returnMsg }).eq("id", id);
    toast.show("Solicitud devuelta para corrección", "info");
    if (req) await supabase.from("notifications").insert({
      user_id: req.tenant_id, type: "request_returned", title: "Solicitud devuelta",
      message: `Tu solicitud para "${property?.name}" fue devuelta: ${returnMsg}`,
      link: `/tenant/requests/${id}`,
    });
    await load();
    setLoading(false);
  };

  if (!req) return <p className="text-muted">Cargando...</p>;

  const isPending = req.status === "pending";
  const isDocsSubmitted = req.status === "docs_submitted";
  const isReturned = req.status === "returned";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-primary">Detalle de solicitud</h1>
      <p className="text-sm text-muted mb-4">Estado: {REQUEST_STATUSES[req.status]}</p>
      {property && <p className="mb-4 font-medium">{property.name} — {property.location}</p>}

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-2">Documentos adjuntos</h2>
        {docs.length === 0 && <p className="text-sm text-muted">Aún no se han subido documentos.</p>}
        <ul className="flex flex-col gap-1">
          {docs.map((d) => (
            <li key={d.id} className="text-sm">
              <a href={d.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{d.doc_type}</a>
            </li>
          ))}
        </ul>
        {req.labor_profile && <p className="mt-2 text-sm text-muted">Perfil laboral: {req.labor_profile}</p>}
        {req.desired_duration_value && <p className="text-sm text-muted">Duración deseada: {req.desired_duration_value} {req.desired_duration_unit}</p>}
        {req.has_cosigner && <p className="text-sm text-muted">Codeudor: sí {req.cosigner_requires_property ? "(con finca raíz)" : ""}</p>}
      </div>

      {isPending && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold mb-2">Primer filtro (plazo 5 días)</h2>
          <div className="flex flex-col gap-3">
            <Button onClick={firstAccept} loading={loading}>Aceptar</Button>
            <Textarea placeholder="Motivo del rechazo" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="danger" onClick={firstReject} loading={loading}>Rechazar</Button>
          </div>
        </div>
      )}

      {(isDocsSubmitted || isReturned) && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold mb-2">Segundo filtro</h2>
          <div className="flex flex-col gap-3">
            <Button onClick={secondAccept} loading={loading}>Aceptar (final)</Button>
            <Textarea placeholder="Motivo del rechazo" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="danger" onClick={secondReject} loading={loading}>Rechazar</Button>
            <Textarea placeholder="Mensaje de devolución (documento faltante/error)" value={returnMsg} onChange={(e) => setReturnMsg(e.target.value)} />
            <Button variant="secondary" onClick={secondReturn} loading={loading}>Devolver solicitud</Button>
          </div>
        </div>
      )}

      {req.status === "accepted" && (
        <p className="text-sm text-muted">Solicitud aceptada. Contrato pendiente de firma.</p>
      )}
      {req.status === "rejected" && req.rejection_reason && (
        <p className="text-sm text-red-600">Rechazada: {req.rejection_reason}</p>
      )}
      {req.status === "returned" && req.return_message && (
        <p className="text-sm text-yellow-700">Devuelta: {req.return_message}</p>
      )}

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-2">Observaciones privadas</h2>
        <ul className="mb-2 flex flex-col gap-1 text-sm">
          {observations.map((o, i) => (
            <li key={i} className="border-b border-border pb-1">
              <p>{o.text}</p>
              <p className="text-xs text-muted">{new Date(o.at).toLocaleString("es-CO")}</p>
            </li>
          ))}
        </ul>
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} className="w-full rounded border border-border p-2 text-sm" rows={2} placeholder="Nota privada..." />
        <Button size="sm" className="mt-2" onClick={async () => {
          await supabase.from("request_notes").insert({ request_id: id, text: obs, created_at: new Date().toISOString() });
          const { data } = await supabase.from("request_notes").select("*").eq("request_id", id);
          setObservations((data || []).map((n: any) => ({ text: n.text, at: n.created_at })));
          setObs("");
        }}>Guardar observación</Button>
      </div>
    </div>
  );
}
