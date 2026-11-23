"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import { PROPERTY_TYPES, RENTAL_TYPES, PRICE_PERIODS } from "@/lib/constants";
const MapPicker = dynamic(() => import("@/components/property/MapPicker"), { ssr: false });
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";

export default function EditPropertyPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const geocode = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
      const json = await res.json();
      if (json && json.length) {
        setLatitude(parseFloat(json[0].lat));
        setLongitude(parseFloat(json[0].lon));
      }
    } catch {}
    setGeocoding(false);
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState(PROPERTY_TYPES[0]);
  const [maxPeople, setMaxPeople] = useState("1");
  const [area, setArea] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [includesAdmin, setIncludesAdmin] = useState(false);
  const [adminFee, setAdminFee] = useState("");
  const [parking, setParking] = useState("");
  const [floorArea, setFloorArea] = useState("");
  const [condition, setCondition] = useState("usada");
  const [stratum, setStratum] = useState("");
  const [nearby, setNearby] = useState("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [requiresCosigner, setRequiresCosigner] = useState(false);
  const [depositMonths, setDepositMonths] = useState("");
  const [renterType, setRenterType] = useState("dueño directo");
  const [renterName, setRenterName] = useState("");
  const [furnished, setFurnished] = useState("sin amoblar");
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [forNew, setForNew] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [description, setDescription] = useState("");
  const [rentalType, setRentalType] = useState("vivienda");
  const [hasMax, setHasMax] = useState(true);
  const [maxDays, setMaxDays] = useState("");
  const [price, setPrice] = useState("");
  const [pricePeriod, setPricePeriod] = useState("mes");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [social, setSocial] = useState("");
  const [discount, setDiscount] = useState("0");
  const [discountUntil, setDiscountUntil] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("properties").select("*").eq("id", id).single();
      if (data) {
        setName(data.name);
        setType(data.type);
        setMaxPeople(String(data.max_people));
        setArea(String(data.area_sqm));
        setLocation(data.location);
        setAddress(data.address || "");
        setIncludesAdmin(data.includes_administration ?? false);
        setAdminFee(data.administration_fee ? String(data.administration_fee) : "");
        setParking(data.parking != null ? String(data.parking) : "");
        setFloorArea(data.floor_area ? String(data.floor_area) : "");
        setCondition(data.condition || "usada");
        setStratum(data.stratum ? String(data.stratum) : "");
        setNearby(data.nearby_centers || "");
        setAvailableFrom(data.available_from || "");
        setRequiresCosigner(data.requires_cosigner ?? false);
        setDepositMonths(data.deposit_months ? String(data.deposit_months) : "");
        setRenterType(data.renter_type || "dueño directo");
        setRenterName(data.renter_name || "");
        setFurnished(data.furnished || "sin amoblar");
        setPetsAllowed(data.pets_allowed ?? false);
        setForNew(data.for_new ?? false);
        setVideoUrl(data.video_url || "");
        setWhatsapp(data.whatsapp_contact || "");
        setLatitude(data.latitude ?? null);
        setLongitude(data.longitude ?? null);
        setDescription(data.description || "");
        setRentalType(data.rental_type);
        setHasMax(data.max_rental_days != null);
        setMaxDays(data.max_rental_days ? String(data.max_rental_days) : "");
        setPrice(String(data.price));
        setPricePeriod(data.price_period);
        setPhone(data.contact_phone || "");
        setEmail(data.contact_email || "");
        setSocial(data.contact_social || "");
        setDiscount(String(data.discount_percent || 0));
        setDiscountUntil(data.discount_until ? data.discount_until.slice(0, 10) : "");
      }
      setLoading(false);
    })();
  }, [id, supabase]);

  const save = async () => {
    setSaving(true);
    setError("");
    const { error: e } = await supabase.from("properties").update({
      name, type, max_people: Number(maxPeople), area_sqm: Number(area), location, address, latitude, longitude,
      includes_administration: includesAdmin, administration_fee: adminFee ? Number(adminFee) : null,
      parking: parking ? Number(parking) : null, floor_area: floorArea ? Number(floorArea) : null,
      condition, stratum: stratum ? Number(stratum) : null, nearby_centers: nearby || null,
      available_from: availableFrom || null, requires_cosigner: requiresCosigner,
      deposit_months: depositMonths ? Number(depositMonths) : null, renter_type: renterType,
      renter_name: renterName || null, furnished, pets_allowed: petsAllowed, for_new: forNew,
      video_url: videoUrl || null, whatsapp_contact: whatsapp || null, description,
      rental_type: rentalType, max_rental_days: hasMax ? Number(maxDays) : null,
      price: Number(price), price_period: pricePeriod, contact_phone: phone, contact_email: email,
      contact_social: social, discount_percent: Number(discount),
      discount_until: discountUntil ? new Date(discountUntil).toISOString() : null,
    }).eq("id", id);
    if (e) { setError(e.message); setSaving(false); return; }

    // notify applicants
    const { data: reqs } = await supabase.from("rental_requests").select("tenant_id").eq("property_id", id);
    const { data: { user } } = await supabase.auth.getUser();
    if (reqs && reqs.length) {
      const notifs = reqs.map((r: any) => ({
        user_id: r.tenant_id,
        type: "property_updated",
        title: "Propiedad actualizada",
        message: `La información de "${name}" ha sido actualizada.`,
        link: `/properties/${id}`,
      }));
      await supabase.from("notifications").insert(notifs);
    }
    setSaving(false);
    router.push("/owner/properties");
  };

  const remove = async () => {
    if (!confirm("¿Eliminar esta propiedad por completo?")) return;
    // notify applicants
    const { data: reqs } = await supabase.from("rental_requests").select("tenant_id").eq("property_id", id);
    const { data } = await supabase.from("properties").select("name").eq("id", id).single();
    if (reqs && reqs.length) {
      const notifs = reqs.map((r: any) => ({
        user_id: r.tenant_id,
        type: "property_removed",
        title: "Propiedad retirada",
        message: `La propiedad "${data?.name}" ya no se puede solicitar porque ha sido retirada.`,
        link: "/",
      }));
      await supabase.from("notifications").insert(notifs);
    }
    await supabase.from("properties").delete().eq("id", id);
    router.push("/owner/properties");
  };

  if (loading) return <p className="text-muted">Cargando...</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-primary">Editar inmueble</h1>
      <div className="flex flex-col gap-4">
        <Input label="Nombre del lugar" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Tipo de inmueble" value={type} onChange={(e) => setType(e.target.value)} options={PROPERTY_TYPES.map((t) => ({ value: t, label: t }))} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Máximo de personas" inputMode="numeric" pattern="[0-9]*" value={maxPeople} onChange={(e) => setMaxPeople(e.target.value.replace(/\D/g, ""))} />
          <Input label="Metros cuadrados" inputMode="numeric" pattern="[0-9]*" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ""))} />
        </div>
        <Input label="Lugar" value={location} onChange={(e) => setLocation(e.target.value)} />
        <Textarea label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        <Select label="Tipo de alquiler" value={rentalType} onChange={(e) => setRentalType(e.target.value)} options={RENTAL_TYPES.map((r) => ({ value: r.value, label: r.label }))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasMax} onChange={(e) => setHasMax(e.target.checked)} />
          Tiene máximo de tiempo para alquilar
        </label>
        {hasMax && <Input inputMode="numeric" pattern="[0-9]*" placeholder="Máximo de días" value={maxDays} onChange={(e) => setMaxDays(e.target.value.replace(/\D/g, ""))} />}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Precio" inputMode="numeric" pattern="[0-9]*" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
          <Select label="Período" value={pricePeriod} onChange={(e) => setPricePeriod(e.target.value)} options={PRICE_PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
        </div>
        <Input label="Teléfono de contacto" value={phone} onChange={(e) => { const v = e.target.value; if (/^\d*$/.test(v) && v.length <= 10) setPhone(v); }} maxLength={10} />
        <Input label="Correo de contacto" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" type="email" />
        <Input label="Redes sociales" value={social} onChange={(e) => setSocial(e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Descuento (%)" inputMode="numeric" pattern="[0-9]*" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))} />
          <Input label="Descuento hasta" type="date" value={discountUntil} onChange={(e) => setDiscountUntil(e.target.value)} />
        </div>
        <Input label="Dirección (para mapa)" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ej: Medellín, El Poblado" />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={geocode} loading={geocoding}>Buscar en mapa</Button>
        </div>
        <MapPicker latitude={latitude} longitude={longitude} onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} />
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 font-semibold">Características adicionales</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includesAdmin} onChange={(e) => setIncludesAdmin(e.target.checked)} /> Incluye administración</label>
            <Input label="Valor administración" inputMode="numeric" value={adminFee} onChange={(e) => setAdminFee(e.target.value.replace(/\\D/g, ""))} />
            <Input label="Parqueaderos" inputMode="numeric" value={parking} onChange={(e) => setParking(e.target.value.replace(/\\D/g, ""))} />
            <Input label="Área del piso (m²)" inputMode="numeric" value={floorArea} onChange={(e) => setFloorArea(e.target.value.replace(/\\D/g, ""))} />
            <Select label="Condición" value={condition} onChange={(e) => setCondition(e.target.value)} options={[{ value: "nueva", label: "Para estrenar" }, { value: "usada", label: "Usada" }]} />
            <Input label="Estrato" inputMode="numeric" value={stratum} onChange={(e) => setStratum(e.target.value.replace(/\\D/g, ""))} />
            <Input label="Centros comerciales cercanos" value={nearby} onChange={(e) => setNearby(e.target.value)} />
            <Input label="Disponible desde" type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requiresCosigner} onChange={(e) => setRequiresCosigner(e.target.checked)} /> Requiere codeudor</label>
            <Input label="Meses de depósito" inputMode="numeric" value={depositMonths} onChange={(e) => setDepositMonths(e.target.value.replace(/\\D/g, ""))} />
            <Select label="Arrendador" value={renterType} onChange={(e) => setRenterType(e.target.value)} options={[{ value: "dueño directo", label: "Dueño directo" }, { value: "inmobiliaria", label: "Inmobiliaria" }]} />
            <Input label="Nombre del arrendador" value={renterName} onChange={(e) => setRenterName(e.target.value)} />
            <Select label="Amoblado" value={furnished} onChange={(e) => setFurnished(e.target.value)} options={[{ value: "amoblado", label: "Amoblado" }, { value: "semi", label: "Semi" }, { value: "sin amoblar", label: "Sin amoblar" }]} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={petsAllowed} onChange={(e) => setPetsAllowed(e.target.checked)} /> Mascotas permitidas</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={forNew} onChange={(e) => setForNew(e.target.checked)} /> Para estrenar</label>
            <Input label="Video / recorrido (URL)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
            <Input label="WhatsApp (57...)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\\D/g, ""))} placeholder="573001234567" />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={save} loading={saving}>Guardar cambios</Button>
          <Button variant="danger" onClick={remove}>Eliminar propiedad</Button>
        </div>
      </div>
    </div>
  );
}
