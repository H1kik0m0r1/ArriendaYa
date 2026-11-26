"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, CheckCircle2, ExternalLink, Eye, MailPlus, ShieldCheck, UserCheck } from "lucide-react";
import { z } from "zod";
import { resolvePrivateFileUrl } from "@/lib/storage/private-files";
import {
  fetchAdminUsers,
  fetchAdminVerifications,
  updateAdminUserStatus,
  updateAdminVerification,
} from "@/modules/admin/service";
import type { AdminUserItem, AdminVerificationItem } from "@/modules/admin/types";
import { ownerInvitationSchema } from "@/modules/auth/schemas";
import { createOwnerInvitation } from "@/modules/auth/service";
import type { OwnerInvitation } from "@/modules/auth/types";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

type TabKey = "users" | "invitations" | "verifications";

const inviteFormSchema = ownerInvitationSchema.pick({ email: true });
type InviteFormValues = z.infer<typeof inviteFormSchema>;

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  owner: "Propietario",
  tenant: "Inquilino",
};

export default function AdminUsersPage() {
  const [tab, setTab] = useState<TabKey>("users");
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [invitations, setInvitations] = useState<OwnerInvitation[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const [verifications, setVerifications] = useState<AdminVerificationItem[]>([]);
  const [migrationReady, setMigrationReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [detailUser, setDetailUser] = useState<AdminUserItem | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUserItem | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [reactivateTarget, setReactivateTarget] = useState<AdminUserItem | null>(null);
  const [savingAction, setSavingAction] = useState(false);

  const [verifyTarget, setVerifyTarget] = useState<AdminVerificationItem | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<"pendiente" | "en_revision" | "verificado" | "rechazado">("pendiente");
  const [verifyEmail, setVerifyEmail] = useState(false);
  const [verifyPhone, setVerifyPhone] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [savingVerify, setSavingVerify] = useState(false);

  const [inviteMsg, setInviteMsg] = useState<{ variant: "success" | "error"; text: string } | null>(null);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    const [usersRes, verRes] = await Promise.all([
      fetchAdminUsers({ q, role: roleFilter, status: statusFilter }),
      fetchAdminVerifications(),
    ]);
    if (!usersRes.ok) {
      setError(usersRes.error);
      setLoading(false);
      return;
    }
    setUsers(usersRes.data.users);
    setInvitations(usersRes.data.invitations);
    setMigrationReady(usersRes.data.migrationReady);
    setNowMs(Date.now());
    if (verRes.ok) {
      setVerifications(verRes.data.verifications);
    }
    setLoading(false);
  }, [q, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAll();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadAll]);

  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendTarget) return;
    setSavingAction(true);
    const res = await updateAdminUserStatus(suspendTarget.id, {
      action: "suspend",
      reason: suspendReason,
    });
    setSavingAction(false);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Cuenta suspendida y bloqueada en el servidor", "success");
    setSuspendTarget(null);
    setSuspendReason("");
    await loadAll();
  };

  const handleReactivateConfirm = async () => {
    if (!reactivateTarget) return;
    setSavingAction(true);
    const res = await updateAdminUserStatus(reactivateTarget.id, { action: "reactivate" });
    setSavingAction(false);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Cuenta reactivada sin modificar su rol", "success");
    setReactivateTarget(null);
    await loadAll();
  };

  const onInviteSubmit = async (values: InviteFormValues) => {
    setInviteMsg(null);
    const res = await createOwnerInvitation(values.email);
    if (!res.ok) {
      setInviteMsg({ variant: "error", text: res.error });
      return;
    }
    setInviteMsg({ variant: "success", text: `Invitación registrada para ${res.data.email}` });
    reset({ email: "" });
    await loadAll();
  };

  const openVerifyModal = (item: AdminVerificationItem) => {
    setVerifyTarget(item);
    const st = item.status;
    setVerifyStatus(
      st === "en_revision" || st === "verificado" || st === "rechazado" ? st : "pendiente"
    );
    setVerifyEmail(item.email_verified);
    setVerifyPhone(item.phone_verified);
    setVerifyNotes(item.notes || "");
  };

  const handleVerifySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyTarget) return;
    setSavingVerify(true);
    const res = await updateAdminVerification(verifyTarget.user_id, {
      status: verifyStatus,
      email_verified: verifyEmail,
      phone_verified: verifyPhone,
      notes: verifyNotes,
    });
    setSavingVerify(false);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Verificación de propietario actualizada", "success");
    setVerifyTarget(null);
    await loadAll();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios, accesos y verificaciones"
        subtitle="Administra cuentas registradas, suspensiones, invitaciones de propietarios y verificaciones de identidad."
      />

      {!migrationReady && (
        <Alert variant="warning" title="Migración 0006 pendiente">
          Aplica <code>0006_admin_panel.sql</code> en Supabase antes de ejecutar suspensiones de cuentas o revisiones extendidas.
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { key: "users" as const, label: `Usuarios (${users.length})` },
          { key: "invitations" as const, label: `Invitaciones (${invitations.length})` },
          { key: "verifications" as const, label: `Verificaciones (${verifications.length})` },
        ].map((item) => (
          <Button
            key={item.key}
            type="button"
            size="sm"
            variant={tab === item.key ? "primary" : "secondary"}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === "users" && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:grid-cols-3">
            <Input
              label="Buscar usuario"
              placeholder="Nombre, correo, teléfono o ID"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Rol</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Todos los roles</option>
                <option value="owner">Propietario</option>
                <option value="tenant">Inquilino</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Estado de cuenta</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                <option value="active">Activos</option>
                <option value="suspended">Suspendidos</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-secondary" />
              ))}
            </div>
          ) : error ? (
            <Alert variant="error">{error}</Alert>
          ) : users.length === 0 ? (
            <EmptyState
              title="No se encontraron usuarios"
              message="Ajusta los filtros de búsqueda o rol para visualizar cuentas."
            />
          ) : (
            <div className="space-y-2.5">
              {users.map((u) => {
                const isSuspended = Boolean(u.suspended_at);
                return (
                  <div
                    key={u.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs lg:flex-row lg:items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">{u.full_name || "Sin nombre"}</p>
                        <Badge color={u.role === "admin" ? "blue" : u.role === "owner" ? "green" : "gray"}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                        <Badge color={isSuspended ? "red" : "green"}>
                          {isSuspended ? "Suspendido" : "Activo"}
                        </Badge>
                        {u.role === "owner" && u.verification_status && (
                          <Badge color={u.verification_status === "verificado" ? "green" : "yellow"}>
                            Verificación: {u.verification_status}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted">
                        {u.email} {u.phone ? `· ${u.phone}` : ""} · Registro:{" "}
                        {new Date(u.created_at).toLocaleDateString("es-CO")} ·{" "}
                        {u.properties_count} inmuebles · {u.contracts_count} contratos
                      </p>
                      {isSuspended && u.suspended_reason && (
                        <p className="text-xs text-red-700 dark:text-red-400">Motivo: {u.suspended_reason}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={() => setDetailUser(u)}>
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Detalle</span>
                      </Button>
                      {isSuspended ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => setReactivateTarget(u)}
                        >
                          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Reactivar</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setSuspendReason("");
                            setSuspendTarget(u);
                          }}
                        >
                          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Suspender</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "invitations" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <h2 className="mb-3 font-semibold text-foreground">Invitar propietario</h2>
            <form onSubmit={handleSubmit(onInviteSubmit)} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
              <div className="flex-1">
                <Input
                  label="Correo del propietario"
                  type="email"
                  placeholder="propietario@empresa.com"
                  error={errors.email?.message}
                  required
                  {...register("email")}
                />
              </div>
              <Button type="submit" loading={isSubmitting}>
                <MailPlus className="h-4 w-4" aria-hidden="true" />
                Crear invitación
              </Button>
            </form>
            {inviteMsg && (
              <Alert variant={inviteMsg.variant} className="mt-3">
                {inviteMsg.text}
              </Alert>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <h2 className="mb-3 font-semibold text-foreground">Invitaciones registradas</h2>
            {invitations.length === 0 ? (
              <EmptyState
                title="No hay invitaciones registradas"
                message="Crea una invitación para habilitar el registro de un propietario."
              />
            ) : (
              <ul className="space-y-2 text-sm">
                {invitations.map((inv) => {
                  const expired = Boolean(
                    !inv.used_at &&
                      inv.expires_at &&
                      nowMs > 0 &&
                      new Date(inv.expires_at).getTime() < nowMs
                  );
                  return (
                    <li
                      key={inv.email}
                      className="flex flex-col justify-between gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{inv.email}</p>
                        <p className="text-xs text-muted">
                          Creada: {new Date(inv.created_at).toLocaleDateString("es-CO")}
                          {inv.expires_at ? ` · Expira: ${new Date(inv.expires_at).toLocaleDateString("es-CO")}` : ""}
                        </p>
                      </div>
                      <Badge color={inv.used_at ? "green" : expired ? "red" : "yellow"}>
                        {inv.used_at ? "Utilizada" : expired ? "Expirada" : "Pendiente"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "verifications" && (
        <div className="space-y-3">
          {verifications.length === 0 ? (
            <EmptyState
              title="Sin propietarios para verificar"
              message="Cuando existan propietarios registrados podrás revisar sus verificaciones aquí."
            />
          ) : (
            verifications.map((item) => (
              <div
                key={item.user_id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{item.full_name || "Propietario"}</p>
                    <Badge
                      color={
                        item.status === "verificado"
                          ? "green"
                          : item.status === "rechazado"
                          ? "red"
                          : "yellow"
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted">
                    {item.email} · Correo: {item.email_verified ? "Verificado" : "No"} · Teléfono:{" "}
                    {item.phone_verified ? "Verificado" : "No"} · Documento:{" "}
                    {item.has_identity_doc ? "Adjunto" : "Sin adjunto"}
                  </p>
                  {item.notes && <p className="text-xs text-muted">Notas: {item.notes}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.has_identity_doc && item.identity_doc_url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void resolvePrivateFileUrl("identity-documents", item.identity_doc_url || "").then((url) => {
                          if (!url) {
                            toast.show("No se pudo generar la URL del documento", "error");
                            return;
                          }
                          window.open(url, "_blank", "noopener,noreferrer");
                        });
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Ver documento</span>
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="secondary" onClick={() => openVerifyModal(item)}>
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Revisar</span>
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal open={Boolean(detailUser)} onClose={() => setDetailUser(null)} title="Detalle de usuario" className="max-w-md">
        {detailUser && (
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">ID:</span> <code className="break-all text-xs">{detailUser.id}</code></p>
            <p><span className="font-medium">Nombre:</span> {detailUser.full_name || "No registrado"}</p>
            <p><span className="font-medium">Correo:</span> {detailUser.email}</p>
            <p><span className="font-medium">Teléfono:</span> {detailUser.phone || "No registrado"}</p>
            <p><span className="font-medium">Rol:</span> {ROLE_LABELS[detailUser.role] || detailUser.role}</p>
            <p><span className="font-medium">Estado:</span> {detailUser.suspended_at ? "Suspendido" : "Activo"}</p>
            {detailUser.suspended_at && (
              <Alert variant="error">
                Suspendido el {new Date(detailUser.suspended_at).toLocaleString("es-CO")}.{" "}
                {detailUser.suspended_reason ? `Motivo: ${detailUser.suspended_reason}` : ""}
              </Alert>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        title="Suspender cuenta de usuario"
        className="max-w-md"
      >
        <form onSubmit={handleSuspendSubmit} className="space-y-4">
          <Alert variant="warning">
            La cuenta de <strong>{suspendTarget?.email}</strong> quedará bloqueada en el servidor, en Supabase Auth y en cualquier sesión activa.
          </Alert>
          <Textarea
            label="Motivo de la suspensión"
            rows={3}
            required
            placeholder="Describe el motivo administrativo de la suspensión..."
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSuspendTarget(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={savingAction}>
              Confirmar suspensión
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(reactivateTarget)}
        onClose={() => setReactivateTarget(null)}
        onConfirm={() => void handleReactivateConfirm()}
        title="Reactivar cuenta"
        message={`¿Deseas reactivar la cuenta "${reactivateTarget?.email || ""}" manteniendo su rol original (${reactivateTarget?.role || ""})?`}
        confirmLabel="Sí, reactivar"
        cancelLabel="Cancelar"
        loading={savingAction}
      />

      <Modal
        open={Boolean(verifyTarget)}
        onClose={() => setVerifyTarget(null)}
        title="Revisar verificación de propietario"
        className="max-w-md"
      >
        <form onSubmit={handleVerifySave} className="space-y-4">
          <p className="text-xs text-muted">{verifyTarget?.full_name || verifyTarget?.email}</p>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Estado de verificación</label>
            <select
              value={verifyStatus}
              onChange={(e) =>
                setVerifyStatus(
                  e.target.value as "pendiente" | "en_revision" | "verificado" | "rechazado"
                )
              }
              className="w-full rounded-lg border border-border bg-input-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="pendiente">Pendiente</option>
              <option value="en_revision">En revisión</option>
              <option value="verificado">Verificado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={verifyEmail}
              onChange={(e) => setVerifyEmail(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary"
            />
            <span>Correo verificado</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={verifyPhone}
              onChange={(e) => setVerifyPhone(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary"
            />
            <span>Teléfono verificado</span>
          </label>
          <Textarea
            label="Notas administrativas"
            rows={3}
            placeholder="Observaciones internas de la revisión..."
            value={verifyNotes}
            onChange={(e) => setVerifyNotes(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVerifyTarget(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={savingVerify}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Guardar revisión
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
