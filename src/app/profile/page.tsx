"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, ShieldCheck, Upload, UserRound } from "lucide-react";
import { isDemoMode } from "@/lib/config/env";
import { resolvePrivateFileUrl } from "@/lib/storage/private-files";
import { getCurrentUserProfile } from "@/modules/auth/repository";
import { profileUpdateSchema, type ProfileUpdateFormValues } from "@/modules/auth/schemas";
import { saveOwnProfile } from "@/modules/auth/service";
import { uploadPrivateFile } from "@/modules/shared/upload-client";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  tenant: "Inquilino",
  admin: "Administrador",
};

interface OwnerVerificationState {
  status: string;
  identity_doc_url: string | null;
  notes: string | null;
  email_verified: boolean;
  phone_verified: boolean;
}

const VERIFY_BADGE: Record<string, { label: string; color: "green" | "yellow" | "red" | "blue" }> = {
  verificado: { label: "Verificado", color: "green" },
  en_revision: { label: "En revisión", color: "blue" },
  pendiente: { label: "Pendiente", color: "yellow" },
  rechazado: { label: "Rechazado", color: "red" },
};

export default function ProfilePage() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [msg, setMsg] = useState<{ text: string; variant: "success" | "error" } | null>(null);
  const [verification, setVerification] = useState<OwnerVerificationState | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateFormValues>({
    resolver: zodResolver(profileUpdateSchema),
    mode: "onTouched",
    defaultValues: { fullName: "", phone: "" },
  });

  const loadOwnerVerification = useCallback(async () => {
    if (isDemoMode()) return;
    const res = await fetch("/api/owner/verification");
    if (!res.ok) return;
    const json = (await res.json()) as { verification?: OwnerVerificationState | null };
    setVerification(json.verification ?? null);
  }, []);

  useEffect(() => {
    void getCurrentUserProfile().then(({ user, profile }) => {
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email);
      if (profile) {
        setRole(profile.role);
        reset({
          fullName: profile.full_name || "",
          phone: profile.phone || "",
        });
        if (profile.role === "owner") {
          void loadOwnerVerification();
        }
      }
    });
  }, [loadOwnerVerification, reset]);

  const onSubmit = async (values: ProfileUpdateFormValues) => {
    setMsg(null);
    const res = await saveOwnProfile(values);
    if (!res.ok) {
      setMsg({ text: res.error, variant: "error" });
      return;
    }
    setMsg({ text: "Perfil actualizado correctamente.", variant: "success" });
    toast.show("Perfil guardado", "success");
  };

  const onUploadIdentityDoc = async () => {
    if (!docFile || !userId) {
      toast.show("Selecciona un archivo PDF o imagen", "error");
      return;
    }
    if (isDemoMode()) {
      toast.show("Disponible con Supabase conectado", "info");
      return;
    }
    setUploadingDoc(true);
    try {
      const up = await uploadPrivateFile("identity-documents", userId, docFile);
      if (!up.ok) {
        toast.show(up.error, "error");
        return;
      }
      const saveRes = await fetch("/api/owner/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityDocPath: up.data }),
      });
      const saveJson = (await saveRes.json().catch(() => ({}))) as {
        error?: string;
        verification?: OwnerVerificationState;
      };
      if (!saveRes.ok) {
        toast.show(saveJson.error || "No se pudo guardar la verificación", "error");
        return;
      }
      setVerification(saveJson.verification ?? null);
      setDocFile(null);
      toast.show("Documento enviado para revisión del administrador.", "success");
    } finally {
      setUploadingDoc(false);
    }
  };

  const openCurrentDoc = async () => {
    if (!verification?.identity_doc_url) return;
    const url = await resolvePrivateFileUrl("identity-documents", verification.identity_doc_url);
    if (!url) {
      toast.show("No se pudo abrir el documento", "error");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const fullNameField = register("fullName");
  const phoneField = register("phone");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader
        title="Mi perfil"
        subtitle="Administra tu información de contacto en la plataforma."
        actions={role ? <Badge color="blue">{ROLE_LABELS[role] || role}</Badge> : undefined}
      />

      <Card>
        <CardHeader className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Datos personales</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <Input label="Correo" value={email} disabled />
            <Input label="Rol" value={ROLE_LABELS[role] || role} disabled />
            <Input
              label="Nombre completo"
              error={errors.fullName?.message}
              {...fullNameField}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "");
                setValue("fullName", clean, { shouldValidate: true });
              }}
            />
            <Input
              label="Teléfono celular"
              maxLength={10}
              error={errors.phone?.message}
              {...phoneField}
              onChange={(e) => {
                const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
                setValue("phone", clean, { shouldValidate: true });
              }}
            />
            {msg && <Alert variant={msg.variant}>{msg.text}</Alert>}
            <Button type="submit" loading={isSubmitting}>Guardar cambios</Button>
          </form>
        </CardBody>
      </Card>

      {role === "owner" && (
        <Card>
          <CardHeader className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-primary-dark">Verificación de identidad</h2>
            </div>
            <Badge color={VERIFY_BADGE[verification?.status || "pendiente"]?.color || "yellow"}>
              {VERIFY_BADGE[verification?.status || "pendiente"]?.label || verification?.status || "Pendiente"}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-xs text-muted">
              Sube tu documento de identidad (cédula o pasaporte en PDF, JPG, PNG o WEBP, máximo 10 MB) para que un administrador verifique tu perfil de propietario.
            </p>
            {verification?.notes && (
              <Alert variant={verification.status === "rechazado" ? "warning" : "info"}>
                Observación del administrador: {verification.notes}
              </Alert>
            )}
            {verification?.identity_doc_url && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                <span className="text-muted">Documento cargado actualmente en bóveda privada.</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => void openCurrentDoc()}>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ver documento</span>
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-foreground" htmlFor="owner-id-doc">
                {verification?.identity_doc_url ? "Reemplazar documento de identidad" : "Adjuntar documento de identidad"}
              </label>
              <input
                id="owner-id-doc"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-xs text-foreground"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!docFile}
              loading={uploadingDoc}
              onClick={() => void onUploadIdentityDoc()}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>Enviar documento a verificación</span>
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
