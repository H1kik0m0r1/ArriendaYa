"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Property } from "@/lib/types";
import PropertyCard from "@/components/property/PropertyCard";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function SavedPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [newList, setNewList] = useState("");
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: saved } = await supabase.from("saved_properties").select("property_id").eq("user_id", user.id);
      const ids = (saved || []).map((s: any) => s.property_id);
      if (ids.length) {
        const { data: props } = await supabase.from("properties").select("*").in("id", ids);
        for (const p of props || []) {
          const { data: imgs } = await supabase.from("property_images").select("*").eq("property_id", p.id);
          p.property_images = imgs || [];
        }
        setProperties((props as Property[]) || []);
      }
      const ls = JSON.parse(localStorage.getItem("arriendaya_saved_lists") || "[]");
      setLists(ls.filter((l: any) => l.user_id === user.id));
    })();
  }, [supabase]);

  const createList = async () => {
    if (!newList.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ls = JSON.parse(localStorage.getItem("arriendaya_saved_lists") || "[]");
    const l = { id: Date.now().toString(), user_id: user.id, name: newList, property_ids: [] };
    ls.push(l);
    localStorage.setItem("arriendaya_saved_lists", JSON.stringify(ls));
    setLists((prev) => [...prev, l]);
    setNewList("");
  };

  const toggleCompare = (id: string) => {
    setCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev));
  };

  const compared = properties.filter((p) => compare.includes(p.id));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Mis favoritos</h1>

      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Listas personalizadas</h2>
        <div className="flex gap-2">
          <Input value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="Nombre de la lista" />
          <Button size="sm" onClick={createList}>Crear</Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedList(selectedList === l.id ? null : l.id)}
              className={`rounded-full px-3 py-1 text-xs ${selectedList === l.id ? "bg-primary text-white" : "border border-border"}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {properties.map((p) => (
          <label key={p.id} className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={compare.includes(p.id)} onChange={() => toggleCompare(p.id)} />
            Comparar {p.name}
          </label>
        ))}
      </div>

      {compared.length > 0 && (
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          {compared.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4">
              {p.property_images?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.property_images[0].url} alt={p.name} className="mb-2 h-32 w-full rounded object-cover" />
              )}
              <h3 className="font-semibold">{p.name}</h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                <li><span className="text-muted">Precio:</span> ${p.price.toLocaleString("es-CO")}</li>
                <li><span className="text-muted">M²:</span> {p.area_sqm}</li>
                <li><span className="text-muted">Máx. personas:</span> {p.max_people}</li>
                <li><span className="text-muted">Tipo:</span> {p.type}</li>
                <li><span className="text-muted">Ubicación:</span> {p.location}</li>
              </ul>
            </div>
          ))}
        </div>
      )}

      {properties.length === 0 && <p className="text-muted">No tienes propiedades guardadas.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => <PropertyCard key={p.id} property={p} saved />)}
      </div>
    </div>
  );
}
