"use client";
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Download, Lock } from "lucide-react";
import { fetchAdminAudit } from "@/modules/admin/service";
import type { AdminAuditItem } from "@/modules/admin/types";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AdminAuditItem[]>([]);
  const [migrationReady, setMigrationReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetchAdminAudit({
      q,
      result: resultFilter,
      targetType: targetTypeFilter,
      page,
      pageSize,
    });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setLogs(res.data.logs);
    setTotal(res.data.total ?? res.data.logs.length);
    setMigrationReady(res.data.migrationReady);
    setLoading(false);
  }, [q, resultFilter, targetTypeFilter, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 150);
    return () => clearTimeout(timer);
  }, [load]);

  const csvUrl = (() => {
    const qs = new URLSearchParams({ format: "csv" });
    if (q) qs.set("q", q);
    if (resultFilter) qs.set("result", resultFilter);
    if (targetTypeFilter) qs.set("targetType", targetTypeFilter);
    return `/api/admin/audit?${qs.toString()}`;
  })();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bitácora de auditoría"
        subtitle="Registro inmutable generado exclusivamente en el servidor sobre acciones administrativas."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={csvUrl}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary-light/60"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Exportar CSV</span>
            </a>
            <Badge color="green">
              <Lock className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Solo lectura / Inmutable
            </Badge>
          </div>
        }
      />

      {!migrationReady && (
        <Alert variant="warning" title="Migración 0006 pendiente">
          Ejecuta <code>0006_admin_panel.sql</code> en Supabase para habilitar el esquema estructurado e inmutable de <code>activity_log</code>.
        </Alert>
      )}

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:grid-cols-3">
        <Input
          label="Buscar acción o actor"
          placeholder="Acción, usuario, entidad o ID"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Resultado</label>
          <select
            value={resultFilter}
            onChange={(e) => {
              setResultFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Todos</option>
            <option value="success">Éxito (success)</option>
            <option value="denied">Denegado (denied)</option>
            <option value="error">Error (error)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Elemento afectado</label>
          <select
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Todos</option>
            <option value="user">Usuario</option>
            <option value="property">Inmueble</option>
            <option value="owner">Verificación propietario</option>
            <option value="report">Reporte</option>
            <option value="invitation">Invitación</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-secondary" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="Sin eventos de auditoría"
          message="Las acciones realizadas desde el panel administrativo quedarán registradas aquí."
        />
      ) : (
        <div className="space-y-3">
          <div className="space-y-2.5">
            {logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-border bg-card p-4 shadow-xs text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{log.action}</span>
                    {log.target_type && <Badge color="blue">{log.target_type}</Badge>}
                    <Badge color={log.result === "success" ? "green" : "red"}>{log.result}</Badge>
                  </div>
                  <span className="text-xs text-muted">
                    {new Date(log.created_at).toLocaleString("es-CO")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Responsable: {log.actor_name || log.actor_email || log.user_id || "Sistema"} · Entidad:{" "}
                  {log.entity || "-"} {log.target_id ? `· ID: ${log.target_id}` : ""}
                </p>
                {Object.keys(log.details || {}).length > 0 && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-secondary p-2 text-xs text-muted">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted">
            <span>
              Mostrando página {page} de {totalPages} ({total} registros)
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
