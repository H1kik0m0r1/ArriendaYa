export interface ConversationRow {
  id: string;
  owner_id: string;
  tenant_id: string | null;
  tenant_email: string | null;
  partner_name?: string | null;
  partner_email?: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender: string | null;
  text: string | null;
  created_at: string;
}
