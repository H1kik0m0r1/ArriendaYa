"use client";
import { Minus, Plus, RotateCcw, Search } from "lucide-react";
import { PROPERTY_TYPES, RENTAL_TYPES } from "@/lib/constants";
import Button from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

const PRICE_STEP = 100000;

function PriceStepperInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const numericVal = value ? Math.max(0, Number(value.replace(/\D/g, "")) || 0) : 0;

  const adjust = (delta: number) => {
    const next = Math.max(0, numericVal + delta);
    onChange(next === 0 && delta < 0 ? "" : String(next));
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-input-bg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <button
          type="button"
          onClick={() => adjust(-PRICE_STEP)}
          disabled={!value || numericVal <= 0}
          aria-label={`Reducir ${label.toLowerCase()}`}
          title={`Restar $${PRICE_STEP.toLocaleString("es-CO")}`}
          className="flex items-center justify-center border-r border-border px-2 text-muted transition-colors hover:bg-primary/10 hover:text-foreground disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <div className="relative flex flex-1 items-center">
          <span
            aria-hidden="true"
            className="pointer-events-none pl-2.5 text-sm font-medium text-muted"
          >
            $
          </span>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              const clean = e.target.value.replace(/\D/g, "");
              onChange(clean);
            }}
            className="w-full min-w-0 bg-transparent px-1.5 py-2 text-sm text-foreground outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => adjust(PRICE_STEP)}
          aria-label={`Aumentar ${label.toLowerCase()}`}
          title={`Sumar $${PRICE_STEP.toLocaleString("es-CO")}`}
          className="flex items-center justify-center border-l border-border px-2 text-muted transition-colors hover:bg-primary/10 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function PropertyFilters({
  q,
  setQ,
  type,
  setType,
  priceMin,
  setPriceMin,
  priceMax,
  setPriceMax,
  rentalType = "",
  setRentalType,
  petsAllowed = false,
  setPetsAllowed,
  furnished = "",
  setFurnished,
  sort = "recent",
  setSort,
}: {
  q: string;
  setQ: (v: string) => void;
  type: string;
  setType: (v: string) => void;
  priceMin: string;
  setPriceMin: (v: string) => void;
  priceMax: string;
  setPriceMax: (v: string) => void;
  rentalType?: string;
  setRentalType?: (v: string) => void;
  petsAllowed?: boolean;
  setPetsAllowed?: (v: boolean) => void;
  furnished?: string;
  setFurnished?: (v: string) => void;
  sort?: "recent" | "price_asc" | "price_desc";
  setSort?: (v: "recent" | "price_asc" | "price_desc") => void;
}) {
  const hasFilters = Boolean(
    q || type || priceMin || priceMax || rentalType || petsAllowed || furnished || sort !== "recent"
  );

  const resetFilters = () => {
    setQ("");
    setType("");
    setPriceMin("");
    setPriceMax("");
    setRentalType?.("");
    setPetsAllowed?.(false);
    setFurnished?.("");
    setSort?.("recent");
  };

  return (
    <Card>
      <CardBody className="space-y-3 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="catalog-search" className="mb-1 block text-xs font-medium text-muted">
              Buscar
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <Input
                id="catalog-search"
                placeholder="Nombre, barrio o ciudad..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <Select
              label="Tipo"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[
                { value: "", label: "Todos los tipos" },
                ...PROPERTY_TYPES.map((t) => ({ value: t, label: t })),
              ]}
            />
          </div>

          <div className="lg:col-span-3">
            <PriceStepperInput
              id="filter-price-min"
              label="Precio mín."
              value={priceMin}
              onChange={setPriceMin}
              placeholder="500000"
            />
          </div>

          <div className="lg:col-span-3">
            <PriceStepperInput
              id="filter-price-max"
              label="Precio máx."
              value={priceMax}
              onChange={setPriceMax}
              placeholder="3000000"
            />
          </div>
        </div>

        {(setRentalType || setFurnished || setSort || setPetsAllowed) && (
          <div className="grid grid-cols-1 gap-3 border-t border-border/70 pt-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            {setRentalType && (
              <div className="lg:col-span-3">
                <Select
                  label="Modalidad"
                  value={rentalType}
                  onChange={(e) => setRentalType(e.target.value)}
                  options={[
                    { value: "", label: "Todas" },
                    ...RENTAL_TYPES.map((r) => ({ value: r.value, label: r.label })),
                  ]}
                />
              </div>
            )}
            {setFurnished && (
              <div className="lg:col-span-3">
                <Select
                  label="Mobiliario"
                  value={furnished}
                  onChange={(e) => setFurnished(e.target.value)}
                  options={[
                    { value: "", label: "Cualquiera" },
                    { value: "amoblado", label: "Amoblado" },
                    { value: "semi", label: "Semi-amoblado" },
                    { value: "sin amoblar", label: "Sin amoblar" },
                  ]}
                />
              </div>
            )}
            {setSort && (
              <div className="lg:col-span-3">
                <Select
                  label="Ordenar por"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "recent" | "price_asc" | "price_desc")}
                  options={[
                    { value: "recent", label: "Más recientes" },
                    { value: "price_asc", label: "Menor precio" },
                    { value: "price_desc", label: "Mayor precio" },
                  ]}
                />
              </div>
            )}
            <div className="flex items-center justify-between gap-2 lg:col-span-3">
              {setPetsAllowed && (
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={petsAllowed}
                    onChange={(e) => setPetsAllowed(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span>Acepta mascotas</span>
                </label>
              )}
              {hasFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  aria-label="Limpiar filtros"
                  title="Limpiar filtros"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Limpiar</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
