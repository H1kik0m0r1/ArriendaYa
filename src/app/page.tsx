"use client";
import { useState, useDeferredValue, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { LayoutGrid, LocateFixed, MapPin, Tag } from "lucide-react";
import { useProperties, useSavedIds } from "@/hooks/useProperties";
import { Property } from "@/lib/types";
import { EXAMPLE_PROPERTIES } from "@/lib/examples";
import { isDemoMode } from "@/lib/config/env";
import PropertyCard from "@/components/property/PropertyCard";
import PropertyFilters from "@/components/property/PropertyFilters";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

const PAGE_SIZE = 9;
const HomeMap = dynamic(() => import("@/components/property/HomeMap"), { ssr: false });

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [rentalType, setRentalType] = useState("");
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [furnished, setFurnished] = useState("");
  const [sort, setSort] = useState<"recent" | "price_asc" | "price_desc">("recent");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "map">("list");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(0);

  const dq = useDeferredValue(q);
  const dpriceMin = useDeferredValue(priceMin);
  const dpriceMax = useDeferredValue(priceMax);

  const hasGeoRadius = Boolean(radius > 0 && userLocation);
  const { data: fetched, isLoading } = useProperties({
    q: dq,
    type,
    priceMin: dpriceMin,
    priceMax: dpriceMax,
    rentalType,
    petsAllowed: petsAllowed || undefined,
    furnished,
    sort,
    page,
    pageSize: PAGE_SIZE,
    skipPagination: hasGeoRadius,
  });
  const demoMode = isDemoMode();
  const radiusFiltered = useMemo(() => {
    let base = fetched === undefined ? (demoMode ? EXAMPLE_PROPERTIES : []) : (fetched.data as Property[] || []);
    if (radius > 0 && userLocation) {
      base = base.filter(
        (p) => p.latitude && p.longitude && haversine(userLocation.lat, userLocation.lng, p.latitude, p.longitude) <= radius
      );
    }
    return base;
  }, [fetched, radius, userLocation, demoMode]);

  const total = hasGeoRadius ? radiusFiltered.length : (fetched?.total ?? 0);
  const totalPages = fetched === undefined ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const all = hasGeoRadius
    ? radiusFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : radiusFiltered;

  const { data: savedIds } = useSavedIds();
  const savedSet = savedIds || new Set<string>();

  const handleFilterQ = (v: string) => {
    setQ(v);
    setPage(1);
  };
  const handleFilterType = (v: string) => {
    setType(v);
    setPage(1);
  };
  const handleFilterMin = (v: string) => {
    setPriceMin(v);
    setPage(1);
  };
  const handleFilterMax = (v: string) => {
    setPriceMax(v);
    setPage(1);
  };
  const handleFilterRental = (v: string) => {
    setRentalType(v);
    setPage(1);
  };
  const handleFilterPets = (v: boolean) => {
    setPetsAllowed(v);
    setPage(1);
  };
  const handleFilterFurnished = (v: string) => {
    setFurnished(v);
    setPage(1);
  };
  const handleSort = (v: "recent" | "price_asc" | "price_desc") => {
    setSort(v);
    setPage(1);
  };

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPage(1);
      },
      () => {}
    );
  };

  const discountProp = all.find(
    (p) => (p.discount_percent || 0) > 0 && p.discount_until && new Date(p.discount_until) > new Date()
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Encuentra tu próximo espacio"
        subtitle="Explora viviendas y espacios recreativos verificados listos para arrendar."
      />

      <section aria-label="Filtros de búsqueda">
        <PropertyFilters
          q={q}
          setQ={handleFilterQ}
          type={type}
          setType={handleFilterType}
          priceMin={priceMin}
          setPriceMin={handleFilterMin}
          priceMax={priceMax}
          setPriceMax={handleFilterMax}
          rentalType={rentalType}
          setRentalType={handleFilterRental}
          petsAllowed={petsAllowed}
          setPetsAllowed={handleFilterPets}
          furnished={furnished}
          setFurnished={handleFilterFurnished}
          sort={sort}
          setSort={handleSort}
        />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              view === "list"
                ? "bg-primary-btn text-white"
                : "border border-border bg-card text-foreground hover:bg-primary-light/60"
            }`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            <span>Lista</span>
          </button>
          <button
            type="button"
            onClick={() => setView("map")}
            aria-pressed={view === "map"}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              view === "map"
                ? "bg-primary-btn text-white"
                : "border border-border bg-card text-foreground hover:bg-primary-light/60"
            }`}
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span>Mapa</span>
          </button>
          <button
            type="button"
            onClick={requestLocation}
            aria-pressed={Boolean(userLocation)}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              userLocation
                ? "border-primary bg-primary-light text-primary-dark"
                : "border-border bg-card text-foreground hover:bg-primary-light/60"
            }`}
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            <span>{userLocation ? "Ubicación activa" : "Usar mi ubicación"}</span>
          </button>
        </div>

        {userLocation && (
          <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
            <span className="text-muted">Radio:</span>
            <strong className="text-primary-dark">{radius || "∞"} km</strong>
            <input
              type="range"
              aria-label="Radio de búsqueda en kilómetros"
              min={0}
              max={50}
              value={radius}
              onChange={(e) => {
                setRadius(Number(e.target.value));
                setPage(1);
              }}
              className="w-28 accent-primary sm:w-36"
            />
          </label>
        )}
      </section>

      {discountProp && (
        <section className="rounded-xl border border-primary/40 bg-primary-light/40 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge color="green">
                  <Tag className="mr-1 h-3 w-3" aria-hidden="true" />
                  Oferta destacada ({discountProp.discount_percent}% DTO)
                </Badge>
              </div>
              <h2 className="text-lg font-bold text-primary-dark">{discountProp.name}</h2>
              <p className="text-sm text-muted">
                {discountProp.location} · {discountProp.area_sqm} m²
              </p>
              {discountProp.discount_until && (
                <p className="text-xs text-muted">
                  Termina{" "}
                  {formatDistanceToNow(new Date(discountProp.discount_until), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              )}
            </div>
            <Link
              href={`/properties/${discountProp.id}`}
              className="inline-flex min-h-[40px] items-center justify-center self-start rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white hover:bg-primary-btn-hover md:self-auto"
            >
              Ver oferta
            </Link>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl border border-border bg-surface-secondary" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          title="No se encontraron propiedades"
          message="Prueba ajustando tus filtros de búsqueda, tipo de inmueble o rango de precios."
          action={
            q || type || priceMin || priceMax || rentalType || petsAllowed || furnished || radius > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setQ("");
                  setType("");
                  setPriceMin("");
                  setPriceMax("");
                  setRentalType("");
                  setPetsAllowed(false);
                  setFurnished("");
                  setSort("recent");
                  setRadius(0);
                  setPage(1);
                }}
              >
                Restablecer filtros
              </Button>
            ) : undefined
          }
        />
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
            <nav aria-label="Paginación" className="flex items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="px-2 text-sm text-muted">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
