"use client";
import { useState, useEffect, useDeferredValue, useMemo } from "react";
import dynamic from "next/dynamic";
import { useProperties, useSavedIds } from "@/hooks/useProperties";
import { createClient } from "@/lib/supabase/client";
import { Property } from "@/lib/types";
import { EXAMPLE_PROPERTIES } from "@/lib/examples";
import PropertyCard from "@/components/property/PropertyCard";
import PropertyFilters from "@/components/property/PropertyFilters";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

const PAGE_SIZE = 9;
const HomeMap = dynamic(() => import("@/components/property/HomeMap"), { ssr: false });

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "map">("list");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(0);

  const dq = useDeferredValue(q);
  const dpriceMin = useDeferredValue(priceMin);
  const dpriceMax = useDeferredValue(priceMax);

  const { data: fetched, isLoading } = useProperties({ q: dq, type, priceMin: dpriceMin, priceMax: dpriceMax, page, pageSize: PAGE_SIZE });
  const total = fetched?.total ?? 0;

  const all = useMemo(() => {
    let base = fetched === undefined ? EXAMPLE_PROPERTIES : (fetched.data as Property[] || []);
    if (radius > 0 && userLocation) {
      base = base.filter((p) => p.latitude && p.longitude && haversine(userLocation.lat, userLocation.lng, p.latitude, p.longitude) <= radius);
    }
    return base;
  }, [fetched, radius, userLocation]);

  const totalPages = fetched === undefined ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const { data: savedIds } = useSavedIds();
  const savedSet = savedIds || new Set<string>();

  useEffect(() => { setPage(1); }, [dq, type, dpriceMin, dpriceMax, radius, userLocation]);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  };

  const discountProp = all.find(
    (p) => (p.discount_percent || 0) > 0 && p.discount_until && new Date(p.discount_until) > new Date()
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <PropertyFilters
          q={q} setQ={setQ}
          type={type} setType={setType}
          priceMin={priceMin} setPriceMin={setPriceMin}
          priceMax={priceMax} setPriceMax={setPriceMax}
        />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <button onClick={() => setView("list")} className={`rounded-lg px-3 py-1 text-sm ${view === "list" ? "bg-primary text-white" : "border border-border"}`}>Lista</button>
        <button onClick={() => setView("map")} className={`rounded-lg px-3 py-1 text-sm ${view === "map" ? "bg-primary text-white" : "border border-border"}`}>Mapa</button>
        <button onClick={requestLocation} className="rounded-lg border border-border px-3 py-1 text-sm hover:bg-primary/10">
          {userLocation ? "Ubicación activa" : "Usar mi ubicación"}
        </button>
        {userLocation && (
          <label className="flex items-center gap-2 text-sm">
            Radio: {radius || "∞"} km
            <input type="range" min={0} max={50} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-32" />
          </label>
        )}
      </section>

      {discountProp && (
        <section className="rounded-xl border-2 border-primary bg-primary/5 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="text-xs font-bold uppercase text-primary">Oferta destacada</span>
              <h2 className="text-lg font-bold">{discountProp.name}</h2>
              <p className="text-sm text-muted">{discountProp.location} · {discountProp.area_sqm} m²</p>
              {discountProp.discount_until && (
                <p className="text-xs text-muted">
                  Termina {formatDistanceToNow(new Date(discountProp.discount_until), { addSuffix: true, locale: es })}
                </p>
              )}
            </div>
            <Link href={`/properties/${discountProp.id}`} className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              Ver oferta
            </Link>
          </div>
        </section>
      )}

      {isLoading ? (
        <p className="text-muted">Cargando propiedades...</p>
      ) : all.length === 0 ? (
        <p className="text-muted">No se encontraron propiedades.</p>
      ) : view === "map" ? (
        <HomeMap properties={all} userLocation={userLocation} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {all.map((p, i) => (
              <PropertyCard key={p.id} property={p} saved={savedSet.has(p.id)} priority={i === 0} />
            ))}
          </section>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1 text-sm disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-muted">
                Página {currentPage} de {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-border px-3 py-1 text-sm disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
