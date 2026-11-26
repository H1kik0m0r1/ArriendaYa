"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resolvePrivateFileUrl } from "@/lib/storage/private-files";
import type { Property } from "@/modules/properties/types";
import { getRequestBundle } from "@/modules/rental-requests/repository";
import { requestNoteSchema } from "@/modules/rental-requests/schemas";
import { addRequestNote, executeRequestTransition, reviewRequestDocument } from "@/modules/rental-requests/service";
import type { RentalRequest, RequestDocument, RequestNote } from "@/modules/rental-requests/types";
import { getDocumentStatusBadge, getRequestStatusBadge } from "@/modules/shared/status-badges";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PageHeader from "@/components/ui/PageHeader";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

type NoteFormValues = z.infer<typeof requestNoteSchema>;

export default function OwnerRequestDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();

  const [req, setReq] = useState<RentalRequest | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [docs, setDocs] = useState<RequestDocument[]>([]);
  const [reason, setReason] = useState("");
  const [returnMsg, setReturnMsg] = useState("");
  const [observations, setObservations] = useState<RequestNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectConfirmTarget, setRejectConfirmTarget] = useState<"first_reject" | "second_reject" | null>(null);

  const {
    register: registerNote,
    handleSubmit: handleNoteSubmit,
    reset: resetNote,
    formState: { errors: noteErrors, isSubmitting: savingNote },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(requestNoteSchema),
    mode: "onTouched",
    defaultValues: { text: "" },
  });

  const load = useCallback(async () => {
    const bundle = await getRequestBundle(id);
    setReq(bundle.request);
    setProperty(bundle.property);
    setDocs(bundle.documents);
    setObservations(bundle.notes);
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const openDocument = async (storedPath: string) => {
    const url = await resolvePrivateFileUrl("request-documents", storedPath);
    if (!url) {
      toast.show("No se pudo generar acceso seguro al documento", "error");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const runTransition = async (
    payload: Record<string, unknown>,
    successMsg: string,
    toastType: "success" | "error" | "info" = "success"
  ) => {
    setLoading(true);
    const res = await executeRequestTransition(id, payload, { req, property });
    setLoading(false);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show(successMsg, toastType);
    await load();
  };

  const firstAccept = () => runTransition({ action: "first_accept" }, "Solicitud aceptada (1er filtro)", "success");

  const askReject = (action: "first_reject" | "second_reject") => {
    if (!reason.trim()) {
      toast.show("Indica el motivo del rechazo.", "error");
      return;
    }
    setRejectConfirmTarget(action);
  };

  const confirmReject = async () => {
    if (!rejectConfirmTarget) return;
    const action = rejectConfirmTarget;
    setRejectConfirmTarget(null);
    await runTransition({ action, reason: reason.trim() }, "Solicitud rechazada", "info");
  };

  const secondAccept = () =>
    runTransition({ action: "second_accept" }, "Solicitud aceptada definitivamente. Contrato disponible.", "success");

  const secondReturn = () => {
    if (!returnMsg.trim()) {
      toast.show("Indica qué documento falta o el error.", "error");
      return;
    }
    void runTransition(
      { action: "second_return", returnMessage: returnMsg.trim() },
      "Solicitud devuelta para corrección",
      "info"
    );
  };

  const onReviewDoc = async (docId: string, status: "aprobado" | "rechazado") => {
    setLoading(true);
    const res = await reviewRequestDocument(docId, status);
    setLoading(false);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show(status === "aprobado" ? "Documento aprobado" : "Documento rechazado", "info");
    await load();
  };

  const onSaveNote = async (values: NoteFormValues) => {
    const res = await addRequestNote(id, values.text);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Observación guardada", "success");
    resetNote({ text: "" });
    await load();
  };

  if (!req) return <div className="h-48 animate-pulse rounded-2xl bg-surface-secondary" />;

  const isPending = req.status === "pending";
  const isDocsSubmitted = req.status === "docs_submitted";
  const isReturned = req.status === "returned";
  const statusBadge = getRequestStatusBadge(req.status);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Detalle de solicitud"
        subtitle={property ? `${property.name} — ${property.location}` : undefined}
        actions={<Badge color={statusBadge.color}>{statusBadge.label}</Badge>}
      />

      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <h2 className="mb-2 font-semibold text-foreground">Documentos adjuntos</h2>
        {docs.length === 0 && <p className="text-sm text-muted">Aún no se han subido documentos.</p>}
        <ul className="flex flex-col gap-2">
          {docs.map((d) => {
            const docBadge = getDocumentStatusBadge(d.status);
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 text-sm last:border-b-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => void openDocument(d.file_url)}
                  className="font-medium text-primary hover:underline"
                >
                  {d.doc_type}
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={docBadge.color}>{docBadge.label}</Badge>
                  {(isDocsSubmitted || isReturned) && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={loading || d.status === "aprobado"}
                        onClick={() => void onReviewDoc(d.id, "aprobado")}
                      >
                        Aprobar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={loading || d.status === "rechazado"}
                        onClick={() => void onReviewDoc(d.id, "rechazado")}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {req.labor_profile && <p className="mt-3 text-sm text-muted">Perfil laboral: {req.labor_profile}</p>}
        {req.desired_duration_value && (
          <p className="text-sm text-muted">
            Duración deseada: {req.desired_duration_value} {req.desired_duration_unit}
          </p>
        )}
        {req.has_cosigner && (
          <p className="text-sm text-muted">
            Codeudor: sí {req.cosigner_requires_property ? "(con finca raíz)" : ""}
          </p>
        )}
      </div>

      {isPending && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <h2 className="mb-3 font-semibold text-foreground">Primer filtro (plazo 5 días)</h2>
          <div className="flex flex-col gap-3">
            <Button onClick={() => void firstAccept()} loading={loading}>Aceptar primer filtro</Button>
            <Textarea label="Motivo del rechazo (en caso de rechazar)" placeholder="Explica el motivo..." value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="danger" onClick={() => askReject("first_reject")} loading={loading}>Rechazar solicitud</Button>
          </div>
        </div>
      )}

      {(isDocsSubmitted || isReturned) && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <h2 className="mb-3 font-semibold text-foreground">Segundo filtro</h2>
          <div className="flex flex-col gap-3">
            <Button onClick={() => void secondAccept()} loading={loading}>Aceptar definitivamente y generar contrato</Button>
            <Textarea label="Motivo del rechazo" placeholder="Explica el motivo..." value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="danger" onClick={() => askReject("second_reject")} loading={loading}>Rechazar solicitud</Button>
            <Textarea
              label="Mensaje de devolución"
              placeholder="Indica qué documento falta o debe corregirse..."
              value={returnMsg}
              onChange={(e) => setReturnMsg(e.target.value)}
            />
            <Button variant="secondary" onClick={secondReturn} loading={loading}>Devolver solicitud</Button>
          </div>
        </div>
      )}

      {req.status === "accepted" && (
        <Alert variant="success">Solicitud aceptada. El contrato ya está disponible para firma.</Alert>
      )}
      {req.status === "rejected" && req.rejection_reason && (
        <Alert variant="error">Rechazada: {req.rejection_reason}</Alert>
      )}
      {req.status === "returned" && req.return_message && (
        <Alert variant="warning" className="mt-4">Devuelta: {req.return_message}</Alert>
      )}

      <form onSubmit={handleNoteSubmit(onSaveNote)} className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-xs" noValidate>
        <h2 className="mb-2 font-semibold text-foreground">Observaciones privadas</h2>
        <ul className="mb-3 flex flex-col gap-2 text-sm">
          {observations.map((o, i) => (
            <li key={o.id || i} className="border-b border-border pb-1.5">
              <p>{o.text}</p>
              <p className="text-xs text-muted">{new Date(o.created_at).toLocaleString("es-CO")}</p>
            </li>
          ))}
          {observations.length === 0 && <li className="text-xs text-muted">Sin observaciones privadas aún.</li>}
        </ul>
        <Textarea
          rows={2}
          placeholder="Nota privada visible solo para ti..."
          error={noteErrors.text?.message}
          {...registerNote("text")}
        />
        <Button type="submit" size="sm" className="mt-2" loading={savingNote}>
          Guardar observación
        </Button>
      </form>

      <ConfirmModal
        open={Boolean(rejectConfirmTarget)}
        onClose={() => setRejectConfirmTarget(null)}
        onConfirm={() => void confirmReject()}
        title="Confirmar rechazo"
        message={`¿Deseas rechazar esta solicitud con el motivo indicado ("${reason.trim()}")?`}
        confirmLabel="Sí, rechazar"
        loading={loading}
      />
    </div>
  );
}
