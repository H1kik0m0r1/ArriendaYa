import type { Profile } from "@/modules/auth/types";
import type { Property } from "@/modules/properties/types";

export type ContractStatus = "pending_signatures" | "active" | "expiring" | "suspended" | "renewed";

export interface Contract {
  id: string;
  request_id: string | null;
  property_id: string;
  tenant_id: string;
  owner_id: string;
  start_date: string | null;
  end_date: string | null;
  terms: string | null;
  owner_signature_url: string | null;
  tenant_signature_url: string | null;
  signed_at: string | null;
  status: ContractStatus;
  reminder_month_sent: boolean;
  reminder_week_sent: boolean;
  created_at: string;
  updated_at: string;
  property?: Property;
  tenant?: Profile;
  owner?: Profile;
}
