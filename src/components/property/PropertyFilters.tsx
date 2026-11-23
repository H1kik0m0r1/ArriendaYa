"use client";
import { PROPERTY_TYPES } from "@/lib/constants";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

export default function PropertyFilters({
  q, setQ,
  type, setType,
  priceMin, setPriceMin,
  priceMax, setPriceMax,
}: {
  q: string; setQ: (v: string) => void;
  type: string; setType: (v: string) => void;
  priceMin: string; setPriceMin: (v: string) => void;
  priceMax: string; setPriceMax: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[180px] flex-1">
        <Input placeholder="Buscar por nombre o ubicación..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Select
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={[{ value: "", label: "Tipo (todos)" }, ...PROPERTY_TYPES.map((t) => ({ value: t, label: t }))]}
        className="min-w-[150px]"
      />
      <Input inputMode="numeric" pattern="[0-9]*" placeholder="Precio min" value={priceMin} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setPriceMin(v); }} className="w-28" />
      <Input inputMode="numeric" pattern="[0-9]*" placeholder="Precio max" value={priceMax} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setPriceMax(v); }} className="w-28" />
    </div>
  );
}
