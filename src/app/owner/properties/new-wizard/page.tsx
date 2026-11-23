"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PROPERTY_TYPES, RENTAL_TYPES, PRICE_PERIODS } from "@/lib/constants";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Wizard from "@/components/ui/Wizard";
import dynamic from "next/dynamic";
const MapPicker = dynamic(() => import("@/components/property/MapPicker"), { ssr: false });

export default function NewPropertyWizardPage() {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState(PROPERTY_TYPES[0]);
  const [location, setLocation] = useState("");
  const [rentalType, setRentalType] = useState("vivienda");
  const [maxPeople, setMaxPeople] = useState("1");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [price, setPrice] = useState("");
  const [pricePeriod, setPricePeriod] = useState("mes");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [phone, setPhone] = useState("");

  const publish = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("properties").insert({
      owner_id: user.id, name, type, max_people: Number(maxPeople), area_sqm: Number(area),
      location, description, rental_type: rentalType, price: Number(price), price_period: pricePeriod,
      address, latitude, longitude, contact_phone: phone, status: "published",
    });
    toast.show("¡Tu inmueble ya está publicado!", "success");
    router.push("/owner/properties");
  };

  const steps = [
    { title: "Información general", content: (
      <div className="flex flex-col gap-3">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)} options={PROPERTY_TYPES.map((t) => ({ value: t, label: t }))} />
        <Input label="Ubicación" value={location} onChange={(e) => setLocation(e.target.value)} />
        <Select label="Tipo de alquiler" value={rentalType} onChange={(e) => setRentalType(e.target.value)} options={RENTAL_TYPES.map((r) => ({ value: r.value, label: r.label }))} />
        <Input label="Capacidad máxima" inputMode="numeric" value={maxPeople} onChange={(e) => setMaxPeople(e.target.value.replace(/\D/g, ""))} />
      </div>
    ) },
    { title: "Características y descripción", content: (
      <div className="flex flex-col gap-3">
        <Textarea label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        <Input label="Metros cuadrados" inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value.replace(/\D/g, ""))} />
      </div>
    ) },
    { title: "Precio y ubicación", content: (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Input label="Precio" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
          <Select label="Período" value={pricePeriod} onChange={(e) => setPricePeriod(e.target.value)} options={PRICE_PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
        </div>
        <Input label="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} />
        <MapPicker latitude={latitude} longitude={longitude} onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} />
      </div>
    ) },
    { title: "Contacto y revisión", content: (
      <div className="flex flex-col gap-3">
        <Input label="Teléfono de contacto" value={phone} onChange={(e) => { const v = e.target.value; if (/^\d*$/.test(v) && v.length <= 10) setPhone(v); }} maxLength={10} />
        <p className="text-sm text-muted">Revisa los datos antes de publicar.</p>
      </div>
    ) },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-primary">Registrar inmueble (wizard)</h1>
      <Wizard steps={steps} onFinish={publish} />
    </div>
  );
}
