"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ExternalLink, FileText, UploadCloud } from "lucide-react";
import {
  COSIGNER_DOCS,
  LABOR_DOCS,
  LABOR_PROFILES,
  REQUIRED_DOCS_RECREATIVO,
  REQUIRED_DOCS_VIVIENDA,
} from "@/lib/constants";
import { resolvePrivateFileUrl } from "@/lib/storage/private-files";
import type { Property } from "@/modules/properties/types";
import { findContractIdForRequest, getRequestBundle } from "@/modules/rental-requests/repository";
import { requestDocsFormSchema, type RequestDocsFormValues } from "@/modules/rental-requests/schemas";
import { executeRequestTransition, submitRequestDocuments } from "@/modules/rental-requests/service";
import type { RentalRequest, RequestDocument } from "@/modules/rental-requests/types";
import { getDocumentStatusBadge, getRequestStatusBadge } from "@/modules/shared/status-badges";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const STEP_LABELS: { key: string; label: string }[] = [
  { key: "pending", label: "Solicitud enviada" },
  { key: "first_accepted", label: "Pre-aceptada" },
  { key: "docs_submitted", label: "Documentos en revisión" },
  { key: "accepted", label: "Aprobada" },
];

export default function TenantRequestDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();

  const [req, setReq] = useState<RentalRequest | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [docs, setDocs] = useState<RequestDocument[]>([]);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [msg, setMsg] = useState("");
  const [msgError, setMsgError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RequestDocsFormValues>({
    resolver: zodResolver(requestDocsFormSchema),
    mode: "onTouched",
    defaultValues: {
      laborProfile: "empleado",
      hasCosigner: false,
      cosignerRequiresProperty: false,
      durationValue: "",
      durationUnit: "meses",
    },
  });

  const laborProfile = useWatch({ control, name: "laborProfile" });
  const hasCosigner = useWatch({ control, name: "hasCosigner" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const bundle = await getRequestBundle(id);
      setReq(bundle.request);
      setProperty(bundle.property);
      setDocs(bundle.documents);

      if (bundle.request) {
        reset({
          laborProfile: bundle.request.labor_profile || "empleado",
          hasCosigner: Boolean(bundle.request.has_cosigner),
          cosignerRequiresProperty: Boolean(bundle.request.cosigner_requires_property),
          durationValue: bundle.request.desired_duration_value
            ? String(bundle.request.desired_duration_value)
            : "",
          durationUnit:
            bundle.request.desired_duration_unit ||
            (bundle.property?.rental_type === "recreativo" ? "dias" : "meses"),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [id, reset]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const docSlots = (): string[] => {
    if (!property) return [];
    const base = property.rental_type === "vivienda" ? REQUIRED_DOCS_VIVIENDA : REQUIRED_DOCS_RECREATIVO;
    const slots = [...base];
    const labor = LABOR_DOCS[laborProfile as keyof typeof LABOR_DOCS] || [];
    slots.push(...labor);
    if (hasCosigner) slots.push(...COSIGNER_DOCS);
    return slots;
  };

  const openDocument = async (storedPath: string) => {
    const url = await resolvePrivateFileUrl("request-documents", storedPath);
    if (!url) {
      toast.show("No se pudo abrir el documento", "error");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onSubmitDocs = async (values: RequestDocsFormValues) => {
    if (!req || !property) return;
    setMsg("");
    setMsgError(false);
    const res = await submitRequestDocuments(req.id, property, values, files);
    if (!res.ok) {
      setMsg(res.error);
      setMsgError(true);
      return;
    }
    setFiles({});
    setMsg("Documentos enviados. Espera la revisión del propietario.");
    toast.show("Documentos enviados correctamente", "success");
    await load();
  };

  const confirmCancelRequest = async () => {
    if (!req || !property) return;
    setCanceling(true);
    try {
      const res = await executeRequestTransition(req.id, { action: "cancel" });
      if (!res.ok) {
        toast.show(res.error, "error");
        return;
      }
      setCancelOpen(false);
      toast.show("Solicitud cancelada", "info");
      await load();
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-12 w-64 animate-pulse rounded-lg bg-surface-secondary" />
        <div className="h-40 animate-pulse rounded-xl border border-border bg-surface-secondary" />
        <div className="h-56 animate-pulse rounded-xl border border-border bg-surface-secondary" />
      </div>
    );
  }

  if (!req || !property) {
    return (
      <EmptyState
        title="Solicitud no encontrada"
        message="No pudimos encontrar esta solicitud o no tienes permiso para consultarla."
        action={
          <Link
            href="/tenant/requests"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white hover:bg-primary-btn-hover"
          >
            Volver a mis solicitudes
          </Link>
        }
      />
    );
  }

  const canUpload = req.status === "first_accepted" || req.status === "returned";
  const statusBadge = getRequestStatusBadge(req.status);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Detalle de solicitud"
        subtitle={`${property.name} — ${property.location}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={statusBadge.color}>{statusBadge.label}</Badge>
            <Link
              href="/tenant/requests"
              className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary-light/60"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Volver</span>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEP_LABELS.map((step, i) => {
          const active =
            req.status === step.key || (req.status === "returned" && step.key === "docs_submitted");
          return (
            <div
              key={step.key}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                active
                  ? "border-primary-btn bg-primary-btn text-white"
                  : "border-border bg-card text-muted"
              }`}
            >
              {i + 1}. {step.label}
            </div>
          );
        })}
      </div>

      {req.status === "rejected" && req.rejection_reason && (
        <Alert variant="error" title="Solicitud rechazada">
          {req.rejection_reason}
        </Alert>
      )}
      {req.status === "returned" && req.return_message && (
        <Alert variant="warning" title="Documentos devueltos para corrección">
          {req.return_message}
        </Alert>
      )}
      {req.status === "property_rented" && (
        <Alert variant="warning" title="Propiedad no disponible">
          Esta propiedad ya ha sido alquilada.
        </Alert>
      )}

      <Card>
        <CardHeader className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Documentos enviados</h2>
        </CardHeader>
        <CardBody>
          {docs.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay documentos adjuntos.</p>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => {
                const docBadge = getDocumentStatusBadge(d.status);
                return (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <button
                      type="button"
                      onClick={() => void openDocument(d.file_url)}
                      className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      <span>{d.doc_type}</span>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <Badge color={docBadge.color}>{docBadge.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {canUpload && (
        <Card>
          <CardHeader className="flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold text-primary-dark">Subir documentos</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit(onSubmitDocs)} className="flex flex-col gap-4" noValidate>
              <Select
                label="Perfil laboral"
                options={LABOR_PROFILES.map((l) => ({ value: l.value, label: l.label }))}
                {...register("laborProfile")}
              />
              <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" {...register("hasCosigner")} />
                <span>Tiene codeudor/fiador</span>
              </label>
              {hasCosigner && (
                <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" {...register("cosignerRequiresProperty")} />
                  <span>Codeudor con finca raíz</span>
                </label>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label={property.rental_type === "vivienda" ? "Duración (meses, máx 12)" : "Duración (días/horas)"}
                  type="number"
                  error={errors.durationValue?.message}
                  {...register("durationValue")}
                />
                <Select
                  label="Unidad"
                  options={
                    property.rental_type === "vivienda"
                      ? [{ value: "meses", label: "Meses" }, { value: "dias", label: "Días" }]
                      : [{ value: "dias", label: "Días" }, { value: "horas", label: "Horas" }]
                  }
                  {...register("durationUnit")}
                />
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-primary-dark">
                  Archivos (PDF, JPG, PNG o WEBP, máx 10MB)
                </p>
                {docSlots().map((slot) => (
                  <div key={slot} className="rounded-lg border border-border bg-surface-secondary p-3">
                    <label className="mb-1.5 block text-xs font-medium text-muted">{slot}</label>
                    <input
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-dark hover:file:bg-primary-light/80"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setFiles((prev) => ({ ...prev, [slot]: f }));
                      }}
                    />
                  </div>
                ))}
              </div>

              {msg && (
                <Alert variant={msgError ? "error" : "success"}>
                  {msg}
                </Alert>
              )}
              <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
                Enviar documentos
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {req.status === "accepted" && (
        <Alert variant="success" title="Solicitud aprobada">
          <div className="space-y-3">
            <p>Tu solicitud fue aceptada. Procede a revisar y firmar el contrato.</p>
            <Button
              onClick={async () => {
                const contractId = await findContractIdForRequest(req.id);
                if (contractId) router.push(`/contracts/${contractId}`);
              }}
            >
              Ir al contrato
            </Button>
          </div>
        </Alert>
      )}

      {req.status !== "accepted" && req.status !== "rejected" && req.status !== "property_rented" && (
        <div className="flex justify-end">
          <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
            Cancelar solicitud
          </Button>
        </div>
      )}

      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => void confirmCancelRequest()}
        title="Cancelar solicitud"
        message="¿Estás seguro de cancelar esta solicitud de arriendo? Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar solicitud"
        cancelLabel="Volver"
        variant="danger"
        loading={canceling}
      />
    </div>
  );
}
