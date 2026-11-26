"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderHeart, Scale } from "lucide-react";
import { savedListSchema, type SavedListValues } from "@/modules/properties/schemas";
import {
  createTenantSavedList,
  loadTenantSavedData,
  togglePropertyInSavedList,
} from "@/modules/properties/service";
import type { Property, SavedPropertyList } from "@/modules/properties/types";
import PropertyCard from "@/components/property/PropertyCard";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

export default function SavedPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [lists, setLists] = useState<SavedPropertyList[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SavedListValues>({
    resolver: zodResolver(savedListSchema),
    mode: "onTouched",
    defaultValues: { name: "" },
  });

  useEffect(() => {
    void loadTenantSavedData()
      .then((res) => {
        setProperties(res.properties);
        setLists(res.lists);
      })
      .finally(() => setLoading(false));
  }, []);

  const onCreateList = async (values: SavedListValues) => {
    const res = await createTenantSavedList(values.name);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setLists((prev) => [{ ...res.data, property_ids: [] }, ...prev]);
    reset({ name: "" });
    toast.show("Lista creada correctamente", "success");
  };

  const toggleCompare = (id: string) => {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const activeListObj = lists.find((l) => l.id === selectedList) || null;
  const activeIds = new Set(activeListObj?.property_ids || []);
  const displayedProperties = activeListObj
    ? properties.filter((p) => activeIds.has(p.id))
    : properties;

  const handleToggleInActiveList = async (propertyId: string) => {
    if (!activeListObj) return;
    const included = activeIds.has(propertyId);
    setBusyToggle(propertyId);
    const res = await togglePropertyInSavedList(activeListObj.id, propertyId, included);
    setBusyToggle(null);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== activeListObj.id) return l;
        const current = l.property_ids || [];
        return {
          ...l,
          property_ids: included ? current.filter((x) => x !== propertyId) : [...current, propertyId],
        };
      })
    );
    toast.show(included ? "Quitada de la lista" : "Agregada a la lista", "success");
  };

  const compared = properties.filter((p) => compare.includes(p.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis favoritos"
        subtitle="Organiza tus inmuebles guardados en listas y compara hasta 3 propiedades lado a lado."
        actions={
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-primary-light/60"
          >
            Seguir buscando
          </Link>
        }
      />

      <Card>
        <CardHeader className="flex items-center gap-2">
          <FolderHeart className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Listas personalizadas</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <form onSubmit={handleSubmit(onCreateList)} className="flex flex-col gap-2 sm:flex-row sm:items-start" noValidate>
            <div className="flex-1">
              <Input
                label="Nueva lista"
                placeholder="Ej. Cerca de la universidad"
                error={errors.name?.message}
                {...register("name")}
              />
            </div>
            <div className="sm:pt-6">
              <Button type="submit" size="md" loading={isSubmitting} className="w-full sm:w-auto">
                Crear lista
              </Button>
            </div>
          </form>

          {lists.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedList(null)}
                aria-pressed={selectedList === null}
                className={`min-h-[36px] rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
                  selectedList === null
                    ? "bg-primary-btn text-white"
                    : "border border-border bg-card text-foreground hover:bg-primary-light/60"
                }`}
              >
                Todos ({properties.length})
              </button>
              {lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedList(selectedList === l.id ? null : l.id)}
                  aria-pressed={selectedList === l.id}
                  className={`min-h-[36px] rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
                    selectedList === l.id
                      ? "bg-primary-btn text-white"
                      : "border border-border bg-card text-foreground hover:bg-primary-light/60"
                  }`}
                >
                  {l.name} ({l.property_ids?.length || 0})
                </button>
              ))}
            </div>
          )}

          {activeListObj && properties.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-xs font-medium text-muted">
                Asigna o retira tus inmuebles guardados en &ldquo;{activeListObj.name}&rdquo;:
              </p>
              <div className="flex flex-wrap gap-2">
                {properties.map((p) => {
                  const inList = activeIds.has(p.id);
                  return (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant={inList ? "primary" : "secondary"}
                      loading={busyToggle === p.id}
                      onClick={() => void handleToggleInActiveList(p.id)}
                    >
                      {inList ? `✓ ${p.name}` : `+ ${p.name}`}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {properties.length > 0 && (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-primary-dark">Comparador ({compare.length}/3)</h2>
            </div>
            {compare.length > 0 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setCompare([])}>
                Limpiar selección
              </Button>
            )}
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {properties.map((p) => (
                <label
                  key={p.id}
                  className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    compare.includes(p.id)
                      ? "border-primary bg-primary-light/60 font-medium text-primary-dark"
                      : "border-border bg-card text-foreground hover:bg-surface-secondary"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={compare.includes(p.id)}
                    onChange={() => toggleCompare(p.id)}
                  />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>

            {compared.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                {compared.map((p) => (
                  <Card key={p.id}>
                    <CardBody className="space-y-2">
                      {p.property_images?.[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.property_images[0].url}
                          alt={p.name}
                          className="h-32 w-full rounded-lg object-cover"
                        />
                      )}
                      <h3 className="font-semibold text-primary-dark">{p.name}</h3>
                      <ul className="flex flex-col gap-1 text-sm">
                        <li><span className="text-muted">Precio:</span> ${p.price.toLocaleString("es-CO")}</li>
                        <li><span className="text-muted">Área:</span> {p.area_sqm} m²</li>
                        <li><span className="text-muted">Máx. personas:</span> {p.max_people}</li>
                        <li><span className="text-muted">Tipo:</span> {p.type}</li>
                        <li><span className="text-muted">Ubicación:</span> {p.location}</li>
                      </ul>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl border border-border bg-surface-secondary" />
          ))}
        </div>
      ) : displayedProperties.length === 0 ? (
        <EmptyState
          title={activeListObj ? `Sin inmuebles en "${activeListObj.name}"` : "No tienes propiedades guardadas"}
          message={
            activeListObj
              ? "Usa los botones de arriba para agregar tus inmuebles favoritos a esta lista."
              : "Guarda tus propiedades favoritas desde el catálogo para compararlas o revisarlas luego."
          }
          action={
            activeListObj ? (
              <Button type="button" variant="secondary" onClick={() => setSelectedList(null)}>
                Ver todos los favoritos
              </Button>
            ) : (
              <Link
                href="/"
                className="inline-flex min-h-[40px] items-center rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white hover:bg-primary-btn-hover"
              >
                Ver catálogo
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedProperties.map((p) => (
            <PropertyCard key={p.id} property={p} saved />
          ))}
        </div>
      )}
    </div>
  );
}
