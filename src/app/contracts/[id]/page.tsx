"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Contract, Property } from "@/lib/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import dynamic from "next/dynamic";
const SignatureCanvas = dynamic(() => import("react-signature-canvas"), { ssr: false }) as any;

export default function ContractDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [contract, setContract] = useState<Contract | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isTenant, setIsTenant] = useState(false);
  const [terms, setTerms] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const ownerSigRef = useRef<any>(null);
  const tenantSigRef = useRef<any>(null);

  const load = async () => {
    const { data: c } = await supabase.from("contracts").select("*").eq("id", id).single();
    setContract(c as Contract);
    if (c) {
      const { data: p } = await supabase.from("properties").select("*").eq("id", c.property_id).single();
      setProperty(p as Property);
      setTerms(c.terms || "Contrato de arriendo básico. El arrendatario se compromete a pagar la renta puntualmente y a cuidar el inmueble.");
      setStartDate(c.start_date || "");
      setEndDate(c.end_date || "");
      const { data: { user } } = await supabase.auth.getUser();
      setIsOwner(user?.id === c.owner_id);
      setIsTenant(user?.id === c.tenant_id);
    }
  };
  useEffect(() => { load(); }, [id]);

  const saveTerms = async () => {
    await supabase.from("contracts").update({ terms, start_date: startDate, end_date: endDate }).eq("id", id);
    setMsg("Contrato actualizado.");
  };

  const sign = async (role: "owner" | "tenant") => {
    const ref = role === "owner" ? ownerSigRef : tenantSigRef;
    if (ref.current.isEmpty()) { setMsg("Dibuja tu firma primero."); return; }
    const dataUrl = ref.current.toDataURL("image/png");
    // upload signature
    const { data: { user } } = await supabase.auth.getUser();
    const path = `signatures/${id}/${role}-${Date.now()}.png`;
    const blob = await (await fetch(dataUrl)).blob();
    const { error: upErr } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });
    if (upErr) { setMsg(upErr.message); return; }
    const { data: signed } = await supabase.storage.from("signatures").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl || path;
    const update = role === "owner" ? { owner_signature_url: url } : { tenant_signature_url: url };
    await supabase.from("contracts").update(update).eq("id", id);
    await load();
    await tryFinalize();
  };

  const tryFinalize = async () => {
    const { data: c } = await supabase.from("contracts").select("*").eq("id", id).single();
    if (c && c.owner_signature_url && c.tenant_signature_url) {
      await supabase.from("contracts").update({ status: "active", signed_at: new Date().toISOString() }).eq("id", id);
      // archive property
      await supabase.from("properties").update({ status: "rented" }).eq("id", c.property_id);
      // notify other applicants
      const { data: reqs } = await supabase.from("rental_requests").select("tenant_id").eq("property_id", c.property_id).neq("id", c.request_id);
      const { data: prop } = await supabase.from("properties").select("name").eq("id", c.property_id).single();
      if (reqs && reqs.length) {
        const notifs = reqs.map((r: any) => ({
          user_id: r.tenant_id,
          type: "property_rented",
          title: "Propiedad alquilada",
          message: `La propiedad "${prop?.name}" ya ha sido alquilada.`,
          link: "/",
        }));
        await supabase.from("notifications").insert(notifs);
      }
      // update rental_requests status for accepted one
      if (c.request_id) await supabase.from("rental_requests").update({ status: "accepted" }).eq("id", c.request_id);
      setMsg("Contrato firmado y finalizado. La propiedad ha sido archivada.");
      await load();
    }
  };

  const clearSig = (role: "owner" | "tenant") => {
    const ref = role === "owner" ? ownerSigRef : tenantSigRef;
    ref.current?.clear();
  };

  if (!contract) return <p className="text-muted">Cargando...</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-primary">Contrato de arriendo</h1>
      <p className="text-sm text-muted mb-4">Estado: {contract.status}</p>
      {property && <p className="mb-4 font-medium">{property.name}</p>}

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-2">Términos</h2>
        <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={6} />
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Input label="Fecha inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="Fecha fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        {isOwner && (
          <Button className="mt-3" variant="secondary" onClick={saveTerms}>Guardar términos</Button>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-2">Firma del propietario</h2>
        {contract.owner_signature_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={contract.owner_signature_url} alt="firma propietario" className="h-24 border" />
        ) : isOwner ? (
          <>
            <SignatureCanvas ref={ownerSigRef} canvasProps={{ className: "w-full h-32 border rounded" }} />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => sign("owner")}>Firmar</Button>
              <Button size="sm" variant="ghost" onClick={() => clearSig("owner")}>Limpiar</Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Pendiente de firma del propietario.</p>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold mb-2">Firma del inquilino</h2>
        {contract.tenant_signature_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={contract.tenant_signature_url} alt="firma inquilino" className="h-24 border" />
        ) : isTenant ? (
          <>
            <SignatureCanvas ref={tenantSigRef} canvasProps={{ className: "w-full h-32 border rounded" }} />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => sign("tenant")}>Firmar</Button>
              <Button size="sm" variant="ghost" onClick={() => clearSig("tenant")}>Limpiar</Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Pendiente de firma del inquilino.</p>
        )}
      </div>

      {isOwner && contract.status === "active" && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold mb-2">Renovación / Suspensión</h2>
          <div className="flex gap-2">
            <Button onClick={async () => {
              const newEnd = new Date(contract.end_date || new Date());
              newEnd.setMonth(newEnd.getMonth() + 12);
              await supabase.from("contracts").update({ end_date: newEnd.toISOString().slice(0, 10), reminder_month_sent: false, reminder_week_sent: false, status: "active" }).eq("id", id);
              setMsg("Contrato renovado por 12 meses.");
              await load();
            }}>Renovar contrato</Button>
            <Button variant="danger" onClick={async () => {
              await supabase.from("contracts").update({ status: "suspended" }).eq("id", id);
              await supabase.from("properties").update({ status: "published" }).eq("id", contract.property_id);
              setMsg("Contrato suspendido. La propiedad vuelve a estar pública.");
              await load();
            }}>Suspender contrato</Button>
          </div>
        </div>
      )}
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
