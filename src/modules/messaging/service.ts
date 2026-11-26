import { isDemoMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";
import { apiJsonFetch, errResult, okResult, type ServiceResult } from "@/modules/shared/service-result";
import {
  insertConversationMessage,
  listConversationMessages,
  listOwnerConversations,
  listTenantConversations,
} from "./repository";
import type { ConversationRow, MessageRow } from "./types";

export async function listUserConversations(
  role: "owner" | "tenant",
  userId: string
): Promise<ConversationRow[]> {
  if (isDemoMode()) {
    return role === "owner" ? listOwnerConversations(userId) : listTenantConversations(userId);
  }
  const res = await apiJsonFetch<{ conversations?: ConversationRow[] }>("/api/conversations");
  if (res.ok && Array.isArray(res.data.conversations)) {
    return res.data.conversations;
  }
  return role === "owner" ? listOwnerConversations(userId) : listTenantConversations(userId);
}

export async function startOwnerConversation(
  tenantEmail: string
): Promise<ServiceResult<ConversationRow>> {
  const normalized = tenantEmail.trim().toLowerCase();

  if (isDemoMode()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errResult("No autenticado");

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("id, email")
      .ilike("email", normalized)
      .maybeSingle();
    if (!targetProfile) {
      return errResult("No se encontró un usuario relacionado con ese correo.");
    }
    const typedTarget = targetProfile as { id: string; email: string };
    const { data, error } = await supabase
      .from("conversations")
      .insert({ owner_id: user.id, tenant_id: typedTarget.id, tenant_email: typedTarget.email })
      .select()
      .single();
    if (error || !data) {
      return errResult(error?.message || "No se pudo crear la conversación");
    }
    return okResult(data as ConversationRow);
  }

  const res = await apiJsonFetch<{ conversation?: ConversationRow }>("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantEmail: normalized }),
  });
  if (!res.ok) return res;
  if (!res.data.conversation) return errResult("No se recibió la conversación creada");
  return okResult(res.data.conversation);
}

export async function sendOwnerMessage(
  conversationId: string,
  text: string
): Promise<ServiceResult<MessageRow[]>> {
  const clean = text.trim();
  if (isDemoMode()) {
    const { error } = await insertConversationMessage(conversationId, "owner", clean);
    if (error) return errResult(error.message);
    return okResult(await listConversationMessages(conversationId));
  }
  const res = await apiJsonFetch<{ messages?: MessageRow[] }>("/api/conversations/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, text: clean }),
  });
  if (!res.ok) return res;
  return okResult(res.data.messages ?? []);
}

export async function sendTenantMessage(
  conversationId: string,
  text: string
): Promise<ServiceResult<MessageRow[]>> {
  const clean = text.trim();
  if (isDemoMode()) {
    const { error } = await insertConversationMessage(conversationId, "tenant", clean);
    if (error) return errResult(error.message);
    return okResult(await listConversationMessages(conversationId));
  }
  const res = await apiJsonFetch<{ messages?: MessageRow[] }>("/api/conversations/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, text: clean }),
  });
  if (!res.ok) return res;
  return okResult(res.data.messages ?? []);
}
