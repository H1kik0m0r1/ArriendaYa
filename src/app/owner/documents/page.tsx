"use client";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolvePrivateFileUrl } from "@/lib/storage/private-files";
import {
  listOwnerRequestsSummary,
  listRequestDocumentsByRequestId,
} from "@/modules/rental-requests/repository";
import { reviewRequestDocument } from "@/modules/rental-requests/service";
import type { RequestDocument } from "@/modules/rental-requests/types";
import { getDocumentStatusBadge, getRequestStatusBadge } from "@/modules/shared/status-badges";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

interface RequestItem {
  id: string;
  status: string;
}

export default function DocumentsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [selected, setSelected] = useState<RequestItem | null>(null);
  const [docs, setDocs] = useState<RequestDocument[]>([]);
  const [checklist, setChecklist] = useState<Record<string, string>>({});
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
      setRequests(await listOwnerRequestsSummary(user.id));
      setLoading(false);
    })();
  }, []);

  const open = async (r: RequestItem) => {
    setSelected(r);
    const docList = await listRequestDocumentsByRequestId(r.id);
    setDocs(docList);
    const cl: Record<string, string> = {};
    for (const d of docList) cl[d.doc_type] = d.file_url ? "entregado" : "pendiente";
    setChecklist(cl);
  };

  const openFile = async (storedPath: string) => {
    const url = await resolvePrivateFileUrl("request-documents", storedPath);
    if (!url) {
      toast.show("No se pudo abrir el documento", "error");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const verify = async (docId: string, status: "aprobado" | "rechazado") => {
    const res = await reviewRequestDocument(docId, status);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, status } : d)));
    toast.show(`Documento marcado como ${status}`, "success");
  };

  const approvedPercent =
    docs.length > 0 ? Math.round((docs.filter((d) => d.status === "aprobado").length / docs.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Documentación"
        subtitle="Verifica los archivos enviados por tus postulantes mediante enlaces temporales seguros."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <h2 className="mb-3 font-semibold text-foreground">Solicitudes recibidas</h2>
          {loading ? (
            <div className="space-y-2">
              <div className="h-9 animate-pulse rounded-lg bg-surface-secondary" />
              <div className="h-9 animate-pulse rounded-lg bg-surface-secondary" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted">Sin solicitudes todavía.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {requests.map((r) => {
                const badge = getRequestStatusBadge(r.status);
                const isSelected = selected?.id === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => void open(r)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        isSelected ? "bg-primary-light/70 font-semibold text-primary-dark" : "hover:bg-surface-secondary"
                      }`}
                    >
                      <span>Solicitud {r.id.slice(0, 8)}</span>
                      <Badge color={badge.color}>{badge.label}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <h2 className="mb-3 font-semibold text-foreground">Detalle de revisión</h2>
          {!selected ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="Selecciona una solicitud"
              message="Elige una solicitud de la lista para consultar sus documentos y aprobar o rechazar cada entrega."
            />
          ) : (
            <div>
              <p className="mb-3 text-xs text-muted">
                Solicitud {selected.id.slice(0, 8)} · Estado:{" "}
                <span className="font-semibold text-foreground">{getRequestStatusBadge(selected.status).label}</span>
              </p>
              <p className="mb-2 text-sm font-medium">Checklist</p>
              <ul className="mb-4 flex flex-col gap-1 text-sm">
                {Object.keys(checklist).length === 0 && <li className="text-muted">Sin documentos enviados.</li>}
                {Object.entries(checklist).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <Badge color={v === "entregado" ? "green" : "yellow"}>{v}</Badge>
                  </li>
                ))}
              </ul>
              <p className="mb-2 text-sm font-medium">Archivos</p>
              <ul className="flex flex-col gap-2">
                {docs.map((d) => {
                  const docBadge = getDocumentStatusBadge(d.status);
                  return (
                    <li
                      key={d.id}
                      className="flex flex-col gap-2 rounded-xl border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void openFile(d.file_url)}
                          className="font-medium text-primary hover:underline"
                        >
                          {d.doc_type}
                        </button>
                        <Badge color={docBadge.color}>{docBadge.label}</Badge>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => void verify(d.id, "aprobado")}>
                          Aprobar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => void verify(d.id, "rechazado")}>
                          Rechazar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {docs.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>Progreso de aprobación</span>
                    <span>{approvedPercent}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
                    <div className="h-full bg-primary transition-all" style={{ width: `${approvedPercent}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
