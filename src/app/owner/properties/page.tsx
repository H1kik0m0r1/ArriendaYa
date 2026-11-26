"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Edit, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listOwnerProperties } from "@/modules/properties/repository";
import { changeOwnerPropertyStatus, duplicateOwnerProperty } from "@/modules/properties/service";
import type { Property, PropertyStatus } from "@/modules/properties/types";
import { getPropertyStatusBadge } from "@/modules/shared/status-badges";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

export default function OwnerPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setProperties(await listOwnerProperties(user.id));
      setLoading(false);
    })();
  }, []);

  const handleDuplicate = async (p: Property) => {
    const res = await duplicateOwnerProperty(p);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setProperties(res.data);
    toast.show("Propiedad duplicada como borrador", "success");
  };

  const handleStatusChange = async (id: string, newStatus: PropertyStatus) => {
    const res = await changeOwnerPropertyStatus(id, newStatus);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setProperties((prev) => prev.map((x) => (x.id === id ? { ...x, status: res.data } : x)));
    toast.show("Estado actualizado", "success");
  };

  return (
    <div>
      <PageHeader
        title="Mis propiedades"
        subtitle="Administra disponibilidad, edición y publicación de tus inmuebles."
        actions={
          <Link
            href="/owner/properties/new-wizard"
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-btn-hover"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Nueva propiedad</span>
          </Link>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-secondary" />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <EmptyState
          title="Aún no tienes propiedades"
          message="Publica tu primer inmueble para comenzar a recibir solicitudes y programar visitas."
          action={
            <Link
              href="/owner/properties/new-wizard"
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-btn-hover"
            >
              Publicar primera propiedad
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const badge = getPropertyStatusBadge(p.status);
            const isModerated = Boolean(p.moderation_status && p.moderation_status !== "active");
            const photoCount = p.property_images?.length ?? 0;
            const missingPhotos = Math.max(0, 4 - photoCount);
            return (
              <div key={p.id} className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-xs">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Badge color={badge.color}>{badge.label}</Badge>
                      {missingPhotos > 0 && (
                        <Badge color="yellow">{photoCount}/4 fotos</Badge>
                      )}
                      {isModerated && (
                        <Badge color="red">
                          {p.moderation_status === "paused_by_admin"
                            ? "Pausado por admin"
                            : "Suspendido por admin"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted">{p.location}</p>
                  <p className="mt-1 text-base font-bold text-primary">
                    ${new Intl.NumberFormat("es-CO").format(p.price)} /{p.price_period}
                  </p>
                  {missingPhotos > 0 && (
                    <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100">
                      Este inmueble tiene {photoCount} foto(s). Completa al menos 4 fotografías para publicar o republicar.
                    </p>
                  )}
                  {isModerated && (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-100">
                      Medida administrativa activa
                      {p.moderation_reason ? `: ${p.moderation_reason}` : "."}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <Link
                    href={`/owner/properties/${p.id}/edit`}
                    className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary"
                  >
                    <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Editar</span>
                  </Link>
                  <Button size="sm" variant="secondary" onClick={() => void handleDuplicate(p)}>
                    <Copy className="h-3.5 w-3.5" />
                    Duplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isModerated && p.status === "paused"}
                    onClick={() => void handleStatusChange(p.id, p.status === "paused" ? "published" : "paused")}
                  >
                    {p.status === "paused" ? "Reanudar" : "Pausar"}
                  </Button>
                  <select
                    aria-label={`Cambiar estado de ${p.name}`}
                    value={p.status}
                    onChange={(e) => void handleStatusChange(p.id, e.target.value as PropertyStatus)}
                    className="rounded-lg border border-border bg-input-bg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="draft">Borrador</option>
                    <option value="published" disabled={isModerated}>
                      Disponible
                    </option>
                    <option value="rented">Alquilado</option>
                    <option value="paused">Pausado</option>
                    <option value="maintenance">Mantenimiento</option>
                    <option value="archived">Archivado</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
