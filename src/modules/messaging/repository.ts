import { createClient } from "@/lib/supabase/client";
import type { ConversationRow, MessageRow } from "./types";

export async function listOwnerConversations(ownerId: string): Promise<ConversationRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return (data as ConversationRow[] | null) ?? [];
}

export async function listTenantConversations(tenantId: string): Promise<ConversationRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return (data as ConversationRow[] | null) ?? [];
}

export async function listConversationMessages(conversationId: string): Promise<MessageRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data as MessageRow[] | null) ?? [];
}

export async function insertConversationMessage(
  conversationId: string,
  sender: string,
  text: string
) {
  const supabase = createClient();
  return supabase.from("messages").insert({
    conversation_id: conversationId,
    sender,
    text,
    created_at: new Date().toISOString(),
  });
}
