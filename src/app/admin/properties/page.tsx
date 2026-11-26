"use client";
import { useCallback, useEffect, useState } from "react";
import { Eye, PauseCircle, RotateCcw, ShieldAlert } from "lucide-react";
import { fetchAdminProperties, moderateAdminProperty } from "@/modules/admin/service";
import type { AdminPropertyItem } from "@/modules/admin/types";
import { getPropertyStatusBadge } from "@/modules/shared/status-badges";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<AdminPropertyItem[]>([]);
  const [migrationReady, setMigrationReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [moderationFilter, setModerationFilter] = useState("");

  const [detailTarget, setDetailTarget] = useState<AdminPropertyItem | null>(null);
  const [modTarget, setModTarget] = useState<{
    item: AdminPropertyItem;
    action: "pause" | "suspend" | "restore";
  } | null>(null);
  const [modReason, setModReason] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetchAdminProperties({
      q,
      status: statusFilter,
      moderation: moderationFilter,
    });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setProperties(res.data.properties);
    setMigrationReady(res.data.migrationReady);
    setLoading(false);
  }, [q, statusFilter, moderationFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 150);
    return () => clearTimeout(timer);
  }, [load]);

  const handleModerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modTarget) return;
    setSaving(true);
    const res = await moderateAdminProperty(modTarget.item.id, {
      action: modTarget.action,
      reason: modTarget.action === "restore" ? undefined : modReason,
    });
    setSaving(false);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show(
      modTarget.action === "restore"
        ? "Inmueble restaurado en el catálogo público"
        : "Medida de moderación aplicada sin alterar contratos",
      "success"
    );
    setModTarget(null);
    setModReason("");
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisión de inmuebles"
        subtitle="Consulta el inventario completo, revisa contratos asociados y modera publicaciones sin eliminar historial."
      />

      {!migrationReady && (
        <Alert variant="warning" title="Migración 0006 pendiente">
          Ejecuta <code>0006_admin_panel.sql</code> en Supabase para habilitar <code>moderation_status</code> sin sobrescribir <code>status</code>.
        </Alert>
      )}

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:grid-cols-3">
        <Input
          label="Buscar inmueble o propietario"
          placeholder="Nombre, ciudad, tipo o correo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Estado real</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Todos los estados</option>
            <option value="published">Disponible</option>
            <option value="rented">Alquilado</option>
            <option value="draft">Borrador</option>
            <option value="paused">Pausado</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="archived">Archivado</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Moderación</label>
          <select
            value={moderationFilter}
            onChange={(e) => setModerationFilter(e.target.value)}
            className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Todas</option>
            <option value="active">Activa</option>
            <option value="paused_by_admin">Pausado por admin</option>
            <option value="suspended">Suspendido</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-secondary" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : properties.length === 0 ? (
        <EmptyState
          title="No hay inmuebles coincidentes"
          message="Prueba limpiando los filtros o verificando los inmuebles registrados."
        />
      ) : (
        <div className="space-y-3">
          {properties.map((p) => {
            const statusBadge = getPropertyStatusBadge(p.status);
            const isModerated = p.moderation_status !== "active";
            return (
              <div
                key={p.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs lg:flex-row lg:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <Badge color={statusBadge.color}>{statusBadge.label}</Badge>
                    <Badge color={isModerated ? "red" : "green"}>
                      {p.moderation_status === "paused_by_admin"
                        ? "Pausado por admin"
                        : p.moderation_status === "suspended"
                        ? "Suspendido"
                        : "Moderación: Activa"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted">
                    {p.type} · {p.location} · ${new Intl.NumberFormat("es-CO").format(p.price)} /{p.price_period}
                  </p>
                  <p className="truncate text-xs text-muted">
                    Propietario: {p.owner_name || "Sin nombre"} ({p.owner_email || "Sin correo"}) ·{" "}
                    {p.images_count} fotos · {p.requests_count} solicitudes ·{" "}
                    {p.active_contracts_count}/{p.contracts_count} contratos activos
                  </p>
                  {isModerated && p.moderation_reason && (
                    <p className="text-xs text-red-700 dark:text-red-400">Motivo moderación: {p.moderation_reason}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setDetailTarget(p)}>
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Detalle</span>
                  </Button>
                  {p.moderation_status !== "paused_by_admin" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setModReason("");
                        setModTarget({ item: p, action: "pause" });
                      }}
                    >
                      <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Pausar</span>
                    </Button>
                  )}
                  {p.moderation_status !== "suspended" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setModReason("");
                        setModTarget({ item: p, action: "suspend" });
                      }}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Suspender</span>
                    </Button>
                  )}
                  {isModerated && (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setModReason("");
                        setModTarget({ item: p, action: "restore" });
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Restaurar</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(detailTarget)} onClose={() => setDetailTarget(null)} title="Detalle del inmueble" className="max-w-md">
        {detailTarget && (
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Nombre:</span> {detailTarget.name}</p>
            <p><span className="font-medium">Propietario:</span> {detailTarget.owner_name || "Sin nombre"} ({detailTarget.owner_email})</p>
            <p><span className="font-medium">Estado real:</span> {detailTarget.status}</p>
            <p><span className="font-medium">Moderación:</span> {detailTarget.moderation_status}</p>
            <p><span className="font-medium">Solicitudes / Contratos:</span> {detailTarget.requests_count} solicitudes · {detailTarget.contracts_count} contratos ({detailTarget.active_contracts_count} activos)</p>
            {detailTarget.moderation_reason && (
              <Alert variant="warning">Motivo actual: {detailTarget.moderation_reason}</Alert>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(modTarget)}
        onClose={() => setModTarget(null)}
        title={
          modTarget?.action === "restore"
            ? "Restaurar inmueble"
            : modTarget?.action === "pause"
            ? "Pausar publicación administrativamente"
            : "Suspender publicación administrativamente"
        }
        className="max-w-md"
      >
        <form onSubmit={handleModerateSubmit} className="space-y-4">
          <Alert variant={modTarget?.action === "restore" ? "info" : "warning"}>
            {modTarget?.action === "restore"
              ? `El inmueble "${modTarget?.item.name}" volverá a mostrarse según su estado real (${modTarget?.item.status}).`
              : `Esta acción ocultará "${modTarget?.item.name}" del catálogo público sin sobrescribir su estado real (${modTarget?.item.status}) ni cancelar contratos o pagos históricos.`}
          </Alert>
          {modTarget?.action !== "restore" && (
            <Textarea
              label="Motivo de moderación"
              rows={3}
              required
              placeholder="Explica al propietario el motivo de la medida..."
              value={modReason}
              onChange={(e) => setModReason(e.target.value)}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={modTarget?.action === "suspend" ? "danger" : "primary"}
              loading={saving}
            >
              Confirmar acción
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
