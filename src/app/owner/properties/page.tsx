"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { Property } from "@/lib/types";

export default function OwnerPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("properties").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      // attach images
      const props = (data as Property[]) || [];
      for (const p of props) {
        const { data: imgs } = await supabase.from("property_images").select("*").eq("property_id", p.id);
        p.property_images = imgs || [];
      }
      setProperties(props);
    })();
  }, [supabase]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Mis propiedades</h1>
        <Link href="/owner/properties/new-wizard"><Button>Nueva propiedad</Button></Link>
      </div>
      {properties.length === 0 && <p className="text-muted">Aún no tienes propiedades.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-semibold">{p.name}</h3>
            <p className="text-sm text-muted">{p.location} · {p.status}</p>
            <p className="text-sm text-primary font-bold">{new Intl.NumberFormat("es-CO").format(p.price)} {p.price_period}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/owner/properties/${p.id}/edit`}><Button size="sm" variant="secondary">Editar</Button></Link>
              <Button size="sm" variant="secondary" onClick={async () => {
                const copy = { ...p, id: undefined, name: p.name + " (copia)", status: "draft" };
                delete copy.id;
                await supabase.from("properties").insert(copy);
                const { data } = await supabase.from("properties").select("*").eq("owner_id", (await supabase.auth.getUser()).data.user!.id);
                setProperties((data as any) || []);
              }}>Duplicar</Button>
              <Button size="sm" variant="ghost" onClick={async () => {
                const newStatus = p.status === "paused" ? "published" : "paused";
                await supabase.from("properties").update({ status: newStatus }).eq("id", p.id);
                setProperties((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: newStatus } : x)));
              }}>{p.status === "paused" ? "Reanudar" : "Pausar"}</Button>
              <select
                value={p.status}
                onChange={async (e) => {
                  const newStatus = e.target.value as any;
                  await supabase.from("properties").update({ status: newStatus }).eq("id", p.id);
                  setProperties((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: newStatus } : x)));
                }}
                className="rounded border border-border px-2 py-1 text-xs"
              >
                <option value="draft">Borrador</option>
                <option value="published">Disponible</option>
                <option value="rented">Alquilado</option>
                <option value="paused">Pausado</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
