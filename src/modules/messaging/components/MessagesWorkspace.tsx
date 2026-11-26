"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageSquare, Plus, Send } from "lucide-react";
import { getCurrentAuthUser } from "@/modules/auth/repository";
import { listConversationMessages } from "@/modules/messaging/repository";
import {
  createConversationSchema,
  messageCreateSchema,
  type CreateConversationValues,
  type MessageCreateValues,
} from "@/modules/messaging/schemas";
import {
  listUserConversations,
  sendOwnerMessage,
  sendTenantMessage,
  startOwnerConversation,
} from "@/modules/messaging/service";
import type { ConversationRow, MessageRow } from "@/modules/messaging/types";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

const QUICK_REPLIES_OWNER = [
  "Solicitud recibida",
  "Documentación incompleta",
  "Contrato disponible para firmar",
];

const QUICK_REPLIES_TENANT = [
  "Hola, acabo de enviar mis documentos",
  "¿Podríamos agendar una visita?",
  "Ya realicé el pago correspondiente",
];

export default function MessagesWorkspace({ role }: { role: "owner" | "tenant" }) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [active, setActive] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [newConvOpen, setNewConvOpen] = useState(false);
  const toast = useToast();

  const {
    register: registerMsg,
    handleSubmit: handleMsgSubmit,
    setValue: setMsgValue,
    reset: resetMsg,
    formState: { errors: msgErrors, isSubmitting: sending },
  } = useForm<MessageCreateValues>({
    resolver: zodResolver(messageCreateSchema),
    mode: "onSubmit",
    defaultValues: { text: "" },
  });

  const {
    register: registerConv,
    handleSubmit: handleConvSubmit,
    reset: resetConv,
    formState: { errors: convErrors, isSubmitting: creatingConv },
  } = useForm<CreateConversationValues>({
    resolver: zodResolver(createConversationSchema),
    mode: "onTouched",
    defaultValues: { tenantEmail: "" },
  });

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    const user = await getCurrentAuthUser();
    if (!user) {
      setLoadingList(false);
      return;
    }
    const list = await listUserConversations(role, user.id);
    setConversations(list);
    setLoadingList(false);
  }, [role]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadConversations();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadConversations]);

  const openConversation = async (c: ConversationRow) => {
    setActive(c);
    setMessages(await listConversationMessages(c.id));
  };

  useEffect(() => {
    if (!active?.id) return;
    const convId = active.id;
    const interval = setInterval(() => {
      void listConversationMessages(convId).then((next) => {
        setMessages(next);
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [active?.id]);

  const onSend = async (values: MessageCreateValues) => {
    if (!active) return;
    const res =
      role === "owner"
        ? await sendOwnerMessage(active.id, values.text)
        : await sendTenantMessage(active.id, values.text);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setMessages(res.data);
    resetMsg({ text: "" });
  };

  const onCreateConversation = async (values: CreateConversationValues) => {
    const res = await startOwnerConversation(values.tenantEmail);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    const conv = res.data;
    setConversations((prev) => (prev.some((c) => c.id === conv.id) ? prev : [conv, ...prev]));
    setNewConvOpen(false);
    resetConv({ tenantEmail: "" });
    toast.show("Conversación lista", "success");
    await openConversation(conv);
  };

  const quickReplies = role === "owner" ? QUICK_REPLIES_OWNER : QUICK_REPLIES_TENANT;

  return (
    <div>
      <PageHeader
        title="Mensajería"
        subtitle={
          role === "owner"
            ? "Comunícate de forma directa con inquilinos vinculados a tus inmuebles."
            : "Conversaciones activas con los propietarios de tus solicitudes o contratos."
        }
        actions={
          role === "owner" ? (
            <Button size="sm" onClick={() => setNewConvOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva conversación
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-foreground">Conversaciones</h2>
          {loadingList ? (
            <div className="space-y-2">
              <div className="h-9 animate-pulse rounded-lg bg-surface-secondary" />
              <div className="h-9 animate-pulse rounded-lg bg-surface-secondary" />
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {conversations.map((c) => {
                const isSelected = active?.id === c.id;
                const emailLabel = c.partner_email || c.tenant_email;
                const label = c.partner_name
                  ? emailLabel
                    ? `${c.partner_name} (${emailLabel})`
                    : c.partner_name
                  : emailLabel ||
                    (role === "owner"
                      ? `Inquilino ${c.tenant_id?.slice(0, 8) || ""}`
                      : `Propietario ${c.owner_id.slice(0, 8)}`);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void openConversation(c)}
                      className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-primary-light font-semibold text-primary-dark"
                          : "text-foreground hover:bg-surface-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
              {conversations.length === 0 && (
                <li className="py-3 text-sm text-muted">Sin conversaciones activas.</li>
              )}
            </ul>
          )}
          <div className="mt-5 border-t border-border pt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Respuestas rápidas
            </p>
            <div className="flex flex-col gap-1">
              {quickReplies.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setMsgValue("text", r, { shouldValidate: true })}
                  className="rounded px-1.5 py-1 text-left text-xs text-primary hover:bg-primary/10"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm md:col-span-2">
          {!active ? (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title="Selecciona una conversación"
              message={
                role === "owner"
                  ? "Elige un hilo de la izquierda o inicia uno con un inquilino relacionado."
                  : "Elige una conversación para ver tus mensajes y responder."
              }
            />
          ) : (
            <div className="flex flex-col">
              <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                <p className="font-semibold text-foreground">
                  {active.partner_name
                    ? active.partner_email || active.tenant_email
                      ? `${active.partner_name} (${active.partner_email || active.tenant_email})`
                      : active.partner_name
                    : active.partner_email ||
                      active.tenant_email ||
                      (role === "owner" ? "Inquilino" : "Propietario")}
                </p>
                <span className="text-xs text-muted">{messages.length} mensaje(s)</span>
              </div>
              <div className="mb-3 flex h-72 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-surface-secondary/60 p-3">
                {messages.length === 0 ? (
                  <p className="my-auto text-center text-sm text-muted">
                    No hay mensajes todavía. Escribe el primero abajo.
                  </p>
                ) : (
                  messages.map((m) => {
                    const isMine =
                      (role === "owner" && m.sender === "owner") ||
                      (role === "tenant" && m.sender === "tenant");
                    return (
                      <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] break-words rounded-2xl px-3.5 py-2 text-sm shadow-xs ${
                            isMine
                              ? "bg-primary-btn text-white"
                              : "border border-border bg-card text-foreground"
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <form onSubmit={handleMsgSubmit(onSend)} className="flex items-start gap-2" noValidate>
                <div className="flex-1">
                  <Input
                    placeholder="Escribe un mensaje..."
                    error={msgErrors.text?.message}
                    {...registerMsg("text")}
                  />
                </div>
                <Button type="submit" loading={sending} aria-label="Enviar mensaje">
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Enviar</span>
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {role === "owner" && (
        <Modal
          open={newConvOpen}
          onClose={() => setNewConvOpen(false)}
          title="Iniciar nueva conversación"
          className="max-w-md"
        >
          <form onSubmit={handleConvSubmit(onCreateConversation)} className="flex flex-col gap-4" noValidate>
            <p className="text-sm text-muted">
              Ingresa el correo del inquilino que tenga una solicitud, visita, reserva o contrato activo contigo.
            </p>
            <Input
              label="Correo del inquilino"
              type="email"
              placeholder="inquilino@correo.com"
              error={convErrors.tenantEmail?.message}
              required
              {...registerConv("tenantEmail")}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setNewConvOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={creatingConv}>
                Crear conversación
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
