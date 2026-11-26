"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { fetchAdminReports, updateAdminReport } from "@/modules/admin/service";
import type { AdminReportItem } from "@/modules/admin/types";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReportItem[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [rangeFilter, setRangeFilter] = useState("all");

  const [manageTarget, setManageTarget] = useState<AdminReportItem | null>(null);
  const [nextStatus, setNextStatus] = useState<"pendiente" | "en_revision" | "respondido" | "resuelto" | "desestimado">("respondido");
  const [responseText, setResponseText] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetchAdminReports();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setReports(res.data.reports || []);
    setNowMs(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const minMs =
      nowMs > 0
        ? rangeFilter === "7d"
          ? nowMs - 7 * 86400000
          : rangeFilter === "30d"
          ? nowMs - 30 * 86400000
          : 0
        : 0;
    const term = q.trim().toLowerCase();

    return reports.filter((r) => {
      if (statusFilter && (r.status || "pendiente") !== statusFilter) return false;
      if (typeFilter && (r.target_type || "") !== typeFilter) return false;
      if (minMs > 0 && new Date(r.created_at).getTime() < minMs) return false;
      if (term) {
        const hay = `${r.reason || ""} ${r.description || ""} ${r.reporter_name || ""} ${r.reporter_email || ""} ${r.property_name || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [reports, nowMs, q, statusFilter, typeFilter, rangeFilter]);

  const openManage = (report: AdminReportItem) => {
    setManageTarget(report);
    const st = report.status || "pendiente";
    setNextStatus(
      st === "en_revision" || st === "respondido" || st === "resuelto" || st === "desestimado"
        ? st
        : "pendiente"
    );
    setResponseText(report.response || "");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageTarget) return;
    setSaving(true);
    const res = await updateAdminReport(manageTarget.id, {
      status: nextStatus,
      response: responseText.trim() || undefined,
    });
    setSaving(false);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Reporte actualizado correctamente", "success");
    setManageTarget(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de reportes y soporte"
        subtitle="Filtra incidencias por estado, tipo o fecha, revisa el contexto del inmueble y emite respuestas oficiales."
      />

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Buscar reporte"
          placeholder="Motivo, usuario o inmueble"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Estado</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_revision">En revisión</option>
            <option value="respondido">Respondido</option>
            <option value="resuelto">Resuelto</option>
            <option value="desestimado">Desestimado</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Tipo</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Todos</option>
            <option value="property">Inmueble</option>
            <option value="plataforma">Plataforma</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Periodo</label>
          <select
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value)}
            className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="all">Todo el historial</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-secondary" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Sin reportes para mostrar"
          message="No hay reportes que coincidan con los filtros seleccionados."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">
                    {r.reason || "Reporte"}{" "}
                    <span className="text-xs font-normal text-muted">
                      ({r.target_type === "property" ? `Inmueble: ${r.property_name || r.target_id}` : r.target_type || "plataforma"})
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Reportado por: {r.reporter_name || r.reporter_email || r.reporter_id || "Usuario"} ·{" "}
                    {new Date(r.created_at).toLocaleString("es-CO")}
                    {r.updated_at ? ` · Actualizado: ${new Date(r.updated_at).toLocaleString("es-CO")}` : ""}
                  </p>
                </div>
                <Badge
                  color={
                    r.status === "resuelto" || r.status === "respondido"
                      ? "green"
                      : r.status === "desestimado"
                      ? "gray"
                      : "yellow"
                  }
                >
                  {r.status || "pendiente"}
                </Badge>
              </div>
              {r.description && <p className="mt-2 text-sm text-foreground">{r.description}</p>}
              {r.response && (
                <Alert variant="info" className="mt-3">
                  Respuesta oficial: {r.response}
                </Alert>
              )}
              <div className="mt-3 flex justify-end">
                <Button type="button" size="sm" variant="secondary" onClick={() => openManage(r)}>
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Gestionar reporte</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(manageTarget)}
        onClose={() => setManageTarget(null)}
        title="Gestionar reporte"
        className="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <p className="text-xs text-muted">{manageTarget?.reason}</p>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Estado</label>
            <select
              value={nextStatus}
              onChange={(e) =>
                setNextStatus(
                  e.target.value as
                    | "pendiente"
                    | "en_revision"
                    | "respondido"
                    | "resuelto"
                    | "desestimado"
                )
              }
              className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="pendiente">Pendiente</option>
              <option value="en_revision">En revisión</option>
              <option value="respondido">Respondido</option>
              <option value="resuelto">Resuelto</option>
              <option value="desestimado">Desestimado</option>
            </select>
          </div>
          <Textarea
            label="Respuesta oficial"
            rows={4}
            placeholder="Escribe una respuesta para el usuario..."
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setManageTarget(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
