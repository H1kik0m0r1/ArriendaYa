"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Property } from "@/lib/types";
import dynamic from "next/dynamic";
import RequestButton from "@/components/property/RequestButton";
import { isValidVideoUrl } from "@/lib/utils";
const MapView = dynamic(() => import("@/components/property/MapView"), { ssr: false });

export default function PropertyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [property, setProperty] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("properties").select("*").eq("id", id).single();
      setProperty(data);
    })();
  }, [id, supabase]);

  if (!property) return <p className="text-muted">Propiedad no encontrada.</p>;

  const images = property.property_images?.length
    ? property.property_images.map((i: any) => i.url)
    : [];

  const priceLabel = `${new Intl.NumberFormat("es-CO").format(property.price)} ${
    property.price_period === "mes" ? "/mes" : property.price_period === "dia" ? "/día" : "/hora"
  }`;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-primary">{property.name}</h1>
      <p className="text-muted">{property.location} · {property.type}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {images.length ? images.map((u: string, i: number) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={u} alt={`${property.name} ${i + 1}`} loading="lazy" className="h-64 w-full rounded-lg object-cover" />
        )) : (
          <div className="h-64 rounded-lg bg-gray-100" />
        )}
      </div>

      {property.address && (
        <p className="mt-2 text-sm text-muted">📍 {property.address}</p>
      )}
      <div className="mt-4">
        <MapView latitude={property.latitude} longitude={property.longitude} />
        {property.latitude && property.longitude && (
          <a
            href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${property.latitude},${property.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            Cómo llegar →
          </a>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="text-lg font-semibold">Descripción</h2>
          <p className="mt-2 whitespace-pre-line text-sm">{property.description}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">Máx. personas:</span> {property.max_people}</div>
            <div><span className="font-medium">Área:</span> {property.area_sqm} m²</div>
            <div><span className="font-medium">Tipo de alquiler:</span> {property.rental_type}</div>
            <div><span className="font-medium">Máx. tiempo:</span> {property.max_rental_days ? `${property.max_rental_days} días` : "Sin máximo"}</div>
            {property.stratum && <div><span className="font-medium">Estrato:</span> {property.stratum}</div>}
            {property.condition && <div><span className="font-medium">Condición:</span> {property.condition}</div>}
            {property.furnished && <div><span className="font-medium">Amoblado:</span> {property.furnished}</div>}
            {property.pets_allowed != null && <div><span className="font-medium">Mascotas:</span> {property.pets_allowed ? "Permitidas" : "No permitidas"}</div>}
            {property.parking != null && <div><span className="font-medium">Parqueaderos:</span> {property.parking}</div>}
            {property.floor_area && <div><span className="font-medium">Área piso:</span> {property.floor_area} m²</div>}
            {property.available_from && <div><span className="font-medium">Disponible desde:</span> {property.available_from}</div>}
            {property.nearby_centers && <div><span className="font-medium">Centros cercanos:</span> {property.nearby_centers}</div>}
          </div>
        </div>
        <div className="sticky top-24 rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="text-xl font-bold text-primary">${new Intl.NumberFormat("es-CO").format(property.price)} {property.price_period === "mes" ? "/mes" : property.price_period === "dia" ? "/día" : "/hora"}</div>
          {property.includes_administration && <p className="text-xs text-muted">Incluye administración</p>}
          {!property.includes_administration && property.administration_fee && <p className="text-xs text-muted">+ Administración: ${new Intl.NumberFormat("es-CO").format(property.administration_fee)}</p>}
          {property.discount_percent > 0 && (
            <div className="text-sm text-red-600">Descuento {property.discount_percent}%</div>
          )}
          <div className="mt-4">
            <h3 className="font-semibold">Contacto</h3>
            {property.contact_phone && <p className="text-sm">📞 {property.contact_phone}</p>}
            {property.contact_email && <p className="text-sm">✉️ {property.contact_email}</p>}
            {property.contact_social && <p className="text-sm">🔗 {property.contact_social}</p>}
          </div>
          <div className="mt-4">
            <RequestButton propertyId={property.id} ownerId={property.owner_id} />
          </div>
        </div>
      </div>

      {/* Quién arrienda */}
      {(property.renter_name || property.renter_type) && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Quién arrienda</h2>
          <div className="mt-2 flex items-center gap-3">
            {property.renter_photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={property.renter_photo_url} alt={property.renter_name || "Arrendador"} className="h-12 w-12 rounded-full object-cover" />
            )}
            <div>
              <p className="font-medium">{property.renter_name || "Arrendador"}</p>
              <p className="text-sm text-muted">{property.renter_type}</p>
            </div>
          </div>
        </div>
      )}

      {/* Requisitos */}
      {(property.requires_cosigner || property.deposit_months) && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Requisitos</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {property.requires_cosigner && <li>Requiere codeudor/fiador</li>}
            {property.deposit_months && <li>Depósito: {property.deposit_months} mes(es)</li>}
          </ul>
        </div>
      )}

      {/* Video */}
      {property.video_url && isValidVideoUrl(property.video_url) && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Video / Recorrido</h2>
          <div className="mt-2 aspect-video">
            <iframe src={property.video_url} className="h-full w-full rounded" allowFullScreen />
          </div>
        </div>
      )}

      {/* Reviews */}
      {property.reviews && property.reviews.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Opiniones de inquilinos anteriores</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {property.reviews.map((r: any, i: number) => (
              <li key={i} className="border-b border-border pb-2">
                <p className="text-sm font-medium">{r.author} — ⭐ {r.rating}</p>
                <p className="text-sm text-muted">{r.comment}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Acciones */}
      <div className="mt-4 flex flex-wrap gap-2">
        {property.whatsapp_contact && (
          <a
            href={`https://wa.me/${property.whatsapp_contact}?text=${encodeURIComponent("Hola, me interesa el inmueble: " + property.name)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white"
          >
            Contactar por WhatsApp
          </a>
        )}
        <button
          onClick={() => {
            const name = prompt("Tu nombre:");
            const phone = prompt("Tu celular:");
            const date = prompt("Fecha de visita (YYYY-MM-DD):");
            if (!name || !phone || !date) return;
            const visits = JSON.parse(localStorage.getItem("arriendaya_visits") || "[]");
            visits.push({ id: Date.now().toString(), property_id: property.id, name, phone, date, papers: "", created_at: new Date().toISOString() });
            localStorage.setItem("arriendaya_visits", JSON.stringify(visits));
            alert("Visita agendada. El propietario será notificado.");
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white"
        >
          Agendar visita
        </button>
      </div>
    </div>
  );
}
