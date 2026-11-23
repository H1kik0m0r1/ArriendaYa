"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RentalRequest, Property } from "@/lib/types";
import { REQUEST_STATUSES } from "@/lib/constants";
import { LABOR_PROFILES, LABOR_DOCS } from "@/lib/constants";
import { REQUIRED_DOCS_VIVIENDA, REQUIRED_DOCS_RECREATIVO, COSIGNER_DOCS } from "@/lib/constants";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

export default function TenantRequestDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();

  const [req, setReq] = useState<RentalRequest | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [docs, setDocs] = useState<{ id: string; doc_type: string; file_url: string }[]>([]);

  const [laborProfile, setLaborProfile] = useState("empleado");
  const [hasCosigner, setHasCosigner] = useState(false);
  const [cosignerProperty, setCosignerProperty] = useState(false);
  const [durationValue, setDurationValue] = useState("");
  const [durationUnit, setDurationUnit] = useState("meses");

  const [files, setFiles] = useState<Record<string, File>>({});
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data: r } = await supabase.from("rental_requests").select("*").eq("id", id).single();
    setReq(r as RentalRequest);
    if (r) {
      const { data: p } = await supabase.from("properties").select("*").eq("id", r.property_id).single();
      setProperty(p as Property);
      const { data: d } = await supabase.from("request_documents").select("*").eq("request_id", id);
      setDocs(d || []);
      if (r.labor_profile) setLaborProfile(r.labor_profile);
      setHasCosigner(r.has_cosigner);
      setCosignerProperty(r.cosigner_requires_property);
      if (r.desired_duration_value) setDurationValue(String(r.desired_duration_value));
      if (r.desired_duration_unit) setDurationUnit(r.desired_duration_unit);
    }
  };
  useEffect(() => { load(); }, [id]);

  const docSlots = (): string[] => {
    if (!property) return [];
    const base = property.rental_type === "vivienda" ? REQUIRED_DOCS_VIVIENDA : REQUIRED_DOCS_RECREATIVO;
    const slots = [...base];
    const labor = LABOR_DOCS[laborProfile as keyof typeof LABOR_DOCS] || [];
    slots.push(...labor);
    if (hasCosigner) slots.push(...COSIGNER_DOCS);
    return slots;
  };

  const uploadDocs = async () => {
    if (!req || !property) return;
    setUploading(true);
    setMsg("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // validate duration
      const dv = Number(durationValue);
      if (!dv || dv <= 0) throw new Error("Indica la duración deseada.");
      if (property.rental_type === "vivienda") {
        // months up to 12
        if (durationUnit === "meses" && dv > 12) throw new Error("Máximo 12 meses.");
      }
      if (property.max_rental_days && durationUnit === "dias" && dv > property.max_rental_days) {
        throw new Error(`No más de ${property.max_rental_days} días.`);
      }

      // upload each provided file
      for (const [docType, file] of Object.entries(files)) {
        const path = `${user.id}/${req.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("request-documents").upload(path, file);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("request-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
        const url = signed?.signedUrl || path;
        await supabase.from("request_documents").insert({ request_id: req.id, doc_type: docType, file_url: url });
      }

      await supabase.from("rental_requests").update({
        status: "docs_submitted",
        labor_profile: laborProfile as any,
        has_cosigner: hasCosigner,
        cosigner_requires_property: cosignerProperty,
        desired_duration_value: dv,
        desired_duration_unit: durationUnit as any,
      }).eq("id", req.id);

      // notify owner
      await supabase.from("notifications").insert({
        user_id: property.owner_id,
        type: "docs_submitted",
        title: "Documentos recibidos",
        message: `El inquilino envió documentos para "${property.name}".`,
        link: `/owner/requests/${req.id}`,
      });

      setMsg("Documentos enviados. Espera la revisión del propietario.");
      toast.show("Documentos enviados correctamente", "success");
      await load();
    } catch (e: any) {
      setMsg(e.message || "Error");
    } finally {
      setUploading(false);
    }
  };

  if (!req || !property) return <p className="text-muted">Cargando...</p>;

  const canUpload = req.status === "first_accepted" || req.status === "returned";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-primary">Detalle de solicitud</h1>
      <p className="text-sm text-muted mb-4">Estado: {REQUEST_STATUSES[req.status]}</p>
      {/* progress line */}
      <div className="mb-4 flex flex-wrap gap-1 text-xs">
        {["pending", "first_accepted", "docs_submitted", "accepted"].map((s, i) => (
          <span key={s} className={`rounded px-2 py-0.5 ${req.status === s || (req.status === "returned" && s === "docs_submitted") ? "bg-primary text-white" : "bg-gray-100"}`}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <p className="mb-4 font-medium">{property.name} — {property.location}</p>

      {req.status === "rejected" && req.rejection_reason && (
        <p className="mb-4 text-sm text-red-600">Rechazada: {req.rejection_reason}</p>
      )}
      {req.status === "returned" && req.return_message && (
        <p className="mb-4 text-sm text-yellow-700">Devuelta: {req.return_message}</p>
      )}
      {req.status === "property_rented" && (
        <p className="mb-4 text-sm text-red-600">Esta propiedad ya ha sido alquilada.</p>
      )}

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-2">Documentos enviados</h2>
        {docs.length === 0 && <p className="text-sm text-muted">Aún no hay documentos.</p>}
        <ul className="flex flex-col gap-1">
          {docs.map((d) => (
            <li key={d.id} className="text-sm">
              <a href={d.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{d.doc_type}</a>
            </li>
          ))}
        </ul>
      </div>

      {canUpload && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold mb-3">Subir documentos</h2>
          <div className="flex flex-col gap-4">
            <Select
              label="Perfil laboral"
              value={laborProfile}
              onChange={(e) => setLaborProfile(e.target.value)}
              options={LABOR_PROFILES.map((l) => ({ value: l.value, label: l.label }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasCosigner} onChange={(e) => setHasCosigner(e.target.checked)} />
              Tiene codeudor/fiador
            </label>
            {hasCosigner && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cosignerProperty} onChange={(e) => setCosignerProperty(e.target.checked)} />
                Codeudor con finca raíz
              </label>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label={property.rental_type === "vivienda" ? "Duración (meses, máx 12)" : "Duración (días/horas)"}
                type="number"
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
              />
              <Select
                label="Unidad"
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value)}
                options={
                  property.rental_type === "vivienda"
                    ? [{ value: "meses", label: "Meses" }, { value: "dias", label: "Días" }]
                    : [{ value: "dias", label: "Días" }, { value: "horas", label: "Horas" }]
                }
              />
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium">Archivos (uno por documento)</p>
              {docSlots().map((slot) => (
                <div key={slot}>
                  <label className="text-xs text-muted">{slot}</label>
                  <input
                    type="file"
                    className="block w-full text-sm"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFiles((prev) => ({ ...prev, [slot]: f }));
                    }}
                  />
                </div>
              ))}
            </div>

            {msg && <p className="text-sm text-muted">{msg}</p>}
            <Button onClick={uploadDocs} loading={uploading}>Enviar documentos</Button>
          </div>
        </div>
      )}

      {req.status !== "accepted" && req.status !== "rejected" && req.status !== "property_rented" && (
        <div className="mb-4">
          <Button variant="danger" size="sm" onClick={async () => {
            if (!confirm("¿Cancelar esta solicitud?")) return;
            const reason = prompt("Motivo (opcional):") || "";
            await supabase.from("rental_requests").update({ status: "rejected", rejection_reason: reason || "Cancelada por el inquilino" }).eq("id", req.id);
            await supabase.from("notifications").insert({
              user_id: property.owner_id, type: "request_cancelled", title: "Solicitud cancelada",
              message: `El inquilino canceló la solicitud para "${property.name}".`, link: `/owner/requests/${req.id}`,
            });
            await load();
          }}>Cancelar solicitud</Button>
        </div>
      )}

      {req.status === "accepted" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm">Tu solicitud fue aceptada. Procede a firmar el contrato.</p>
          <Button onClick={async () => {
            const { data } = await supabase.from("contracts").select("id").eq("request_id", req.id).single();
            if (data) router.push(`/contracts/${data.id}`);
          }}>Ir al contrato</Button>
        </div>
      )}
    </div>
  );
}
