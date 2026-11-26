"use client";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ComponentType, type Ref } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileText, PenTool, Printer, RefreshCw } from "lucide-react";
import type SignatureCanvasType from "react-signature-canvas";
import { resolvePrivateFileUrl } from "@/lib/storage/private-files";
import { getContractDetail } from "@/modules/contracts/repository";
import { contractTermsSchema, type ContractTermsValues } from "@/modules/contracts/schemas";
import { runContractLifecycleAction, saveContractTerms, signContract } from "@/modules/contracts/service";
import type { Contract } from "@/modules/contracts/types";
import type { Property } from "@/modules/properties/types";
import { getContractStatusBadge } from "@/modules/shared/status-badges";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

const SignatureCanvas = dynamic(() => import("react-signature-canvas"), {
  ssr: false,
}) as unknown as ComponentType<ComponentProps<typeof SignatureCanvasType> & { ref?: Ref<SignatureCanvasType> }>;

const DEFAULT_TERMS =
  "Contrato de arriendo básico. El arrendatario se compromete a pagar la renta puntualmente y a cuidar el inmueble.";

export default function ContractDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();

  const [contract, setContract] = useState<Contract | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isTenant, setIsTenant] = useState(false);
  const [ownerSigUrl, setOwnerSigUrl] = useState<string | null>(null);
  const [tenantSigUrl, setTenantSigUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; variant: "info" | "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  const ownerSigRef = useRef<SignatureCanvasType | null>(null);
  const tenantSigRef = useRef<SignatureCanvasType | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContractTermsValues>({
    resolver: zodResolver(contractTermsSchema),
    mode: "onTouched",
    defaultValues: { terms: DEFAULT_TERMS, startDate: "", endDate: "" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { contract: loaded, property: prop, currentUserId } = await getContractDetail(id);
      setContract(loaded);
      setProperty(prop);

      if (loaded) {
        reset({
          terms: loaded.terms || DEFAULT_TERMS,
          startDate: loaded.start_date || "",
          endDate: loaded.end_date || "",
        });
        setIsOwner(currentUserId === loaded.owner_id);
        setIsTenant(currentUserId === loaded.tenant_id);

        setOwnerSigUrl(
          loaded.owner_signature_url
            ? await resolvePrivateFileUrl("signatures", loaded.owner_signature_url)
            : null
        );
        setTenantSigUrl(
          loaded.tenant_signature_url
            ? await resolvePrivateFileUrl("signatures", loaded.tenant_signature_url)
            : null
        );
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

  const isLocked = Boolean(
    contract &&
      (contract.status !== "pending_signatures" ||
        contract.owner_signature_url ||
        contract.tenant_signature_url ||
        contract.signed_at)
  );

  const onSaveTerms = async (values: ContractTermsValues) => {
    setMsg(null);
    if (isLocked) {
      setMsg({ text: "No se pueden modificar los términos de un contrato firmado.", variant: "error" });
      return;
    }
    const res = await saveContractTerms(id, values);
    if (!res.ok) {
      setMsg({ text: res.error, variant: "error" });
      return;
    }
    setMsg({ text: "Contrato actualizado.", variant: "success" });
    toast.show("Términos actualizados", "success");
    await load();
  };

  const sign = async (role: "owner" | "tenant") => {
    const ref = role === "owner" ? ownerSigRef : tenantSigRef;
    if (!ref.current || ref.current.isEmpty()) {
      setMsg({ text: "Dibuja tu firma primero.", variant: "error" });
      return;
    }
    const dataUrl = ref.current.toDataURL("image/png");
    const res = await signContract(id, role, dataUrl);
    if (!res.ok) {
      setMsg({ text: res.error, variant: "error" });
      return;
    }
    const text = res.data.finalized
      ? "Contrato firmado y finalizado. La propiedad ha sido archivada."
      : "Firma registrada correctamente.";
    setMsg({ text, variant: "success" });
    toast.show(text, "success");
    await load();
  };

  const clearSig = (role: "owner" | "tenant") => {
    const ref = role === "owner" ? ownerSigRef : tenantSigRef;
    ref.current?.clear();
  };

  const runLifecycle = async (action: "renew" | "suspend") => {
    if (!contract) return;
    setLifecycleBusy(true);
    try {
      const res = await runContractLifecycleAction(contract, action);
      if (!res.ok) {
        setMsg({ text: res.error, variant: "error" });
        toast.show(res.error, "error");
        return;
      }
      const text =
        action === "renew"
          ? "Contrato renovado por 12 meses."
          : "Contrato suspendido. La propiedad vuelve a estar pública.";
      setMsg({ text, variant: "success" });
      toast.show(text, "success");
      setSuspendOpen(false);
      await load();
    } finally {
      setLifecycleBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-12 w-64 animate-pulse rounded-lg bg-surface-secondary" />
        <div className="h-56 animate-pulse rounded-xl border border-border bg-surface-secondary" />
        <div className="h-44 animate-pulse rounded-xl border border-border bg-surface-secondary" />
      </div>
    );
  }

  if (!contract) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        message="No pudimos localizar este contrato o no tienes permiso para verlo."
        action={
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white hover:bg-primary-btn-hover"
          >
            Volver al inicio
          </Link>
        }
      />
    );
  }

  const statusBadge = getContractStatusBadge(contract.status);
  const backHref = isOwner ? "/owner/contracts" : "/tenant/contracts";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Contrato de arriendo"
        subtitle={property ? property.name : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={statusBadge.color}>{statusBadge.label}</Badge>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="no-print"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>Imprimir / Guardar PDF</span>
            </Button>
            <Link
              href={backHref}
              className="no-print inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-primary-light/60"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Contratos</span>
            </Link>
          </div>
        }
      />

      {msg && <Alert variant={msg.variant}>{msg.text}</Alert>}

      <Card>
        <CardHeader className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Términos y vigencia</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSaveTerms)} className="space-y-4" noValidate>
            <Textarea
              label="Cláusulas del contrato"
              rows={6}
              disabled={!isOwner || isLocked}
              error={errors.terms?.message}
              {...register("terms")}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Fecha inicio"
                type="date"
                disabled={!isOwner || isLocked}
                error={errors.startDate?.message}
                {...register("startDate")}
              />
              <Input
                label="Fecha fin"
                type="date"
                disabled={!isOwner || isLocked}
                error={errors.endDate?.message}
                {...register("endDate")}
              />
            </div>
            {isOwner && !isLocked && (
              <Button type="submit" variant="secondary" loading={isSubmitting}>
                Guardar términos
              </Button>
            )}
            {isLocked && (
              <Alert variant="info">
                Los términos y fecha de inicio quedan protegidos tras la primera firma.
              </Alert>
            )}
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Firma del propietario</h2>
        </CardHeader>
        <CardBody>
          {contract.owner_signature_url ? (
            ownerSigUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ownerSigUrl}
                alt="Firma del propietario"
                className="h-24 rounded-lg border border-border bg-white p-2"
              />
            ) : (
              <Badge color="green">Firma registrada</Badge>
            )
          ) : isOwner ? (
            <div className="space-y-3">
              <p className="text-xs text-muted">Dibuja tu firma en el recuadro y presiona Firmar.</p>
              <SignatureCanvas
                ref={(instance: SignatureCanvasType | null) => {
                  ownerSigRef.current = instance;
                }}
                canvasProps={{
                  className: "w-full h-36 rounded-lg border border-border bg-white touch-none",
                  "aria-label": "Lienzo para firma del propietario",
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void sign("owner")}>Firmar</Button>
                <Button size="sm" variant="ghost" onClick={() => clearSig("owner")}>Limpiar</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Pendiente de firma del propietario.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Firma del inquilino</h2>
        </CardHeader>
        <CardBody>
          {contract.tenant_signature_url ? (
            tenantSigUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenantSigUrl}
                alt="Firma del inquilino"
                className="h-24 rounded-lg border border-border bg-white p-2"
              />
            ) : (
              <Badge color="green">Firma registrada</Badge>
            )
          ) : isTenant ? (
            <div className="space-y-3">
              <p className="text-xs text-muted">Dibuja tu firma en el recuadro y presiona Firmar.</p>
              <SignatureCanvas
                ref={(instance: SignatureCanvasType | null) => {
                  tenantSigRef.current = instance;
                }}
                canvasProps={{
                  className: "w-full h-36 rounded-lg border border-border bg-white touch-none",
                  "aria-label": "Lienzo para firma del inquilino",
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void sign("tenant")}>Firmar</Button>
                <Button size="sm" variant="ghost" onClick={() => clearSig("tenant")}>Limpiar</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Pendiente de firma del inquilino.</p>
          )}
        </CardBody>
      </Card>

      {isOwner && contract.status === "active" && (
        <Card>
          <CardHeader className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold text-primary-dark">Renovación / Suspensión</h2>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-3">
            <Button onClick={() => void runLifecycle("renew")} loading={lifecycleBusy}>
              Renovar contrato (12 meses)
            </Button>
            <Button variant="danger" onClick={() => setSuspendOpen(true)} disabled={lifecycleBusy}>
              Suspender contrato
            </Button>
          </CardBody>
        </Card>
      )}

      <ConfirmModal
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        onConfirm={() => void runLifecycle("suspend")}
        title="Suspender contrato"
        message="Esta acción finalizará el contrato activo y volverá a publicar el inmueble en el catálogo. ¿Deseas continuar?"
        confirmLabel="Sí, suspender contrato"
        cancelLabel="Cancelar"
        variant="danger"
        loading={lifecycleBusy}
      />
    </div>
  );
}
