import type { Profile } from "@/modules/auth/types";
import type { Property } from "@/modules/properties/types";

export type RequestStatus =
  | "pending"
  | "first_accepted"
  | "docs_submitted"
  | "returned"
  | "accepted"
  | "rejected"
  | "expired"
  | "property_rented";

export type LaborProfile = "empleado" | "independiente" | "pensionado";
export type DurationUnit = "dias" | "meses" | "horas";

export interface RentalRequest {
  id: string;
  property_id: string;
  tenant_id: string;
  status: RequestStatus;
  first_deadline: string;
  first_decision_at: string | null;
  rejection_reason: string | null;
  return_message: string | null;
  desired_duration_value: number | null;
  desired_duration_unit: DurationUnit | null;
  labor_profile: LaborProfile | null;
  has_cosigner: boolean;
  cosigner_requires_property: boolean;
  created_at: string;
  updated_at: string;
  property?: Property;
  tenant?: Profile;
}

export interface RequestDocument {
  id: string;
  request_id: string;
  doc_type: string;
  file_url: string;
  status: "pendiente" | "aprobado" | "rechazado" | string;
  delivered_at?: string | null;
  uploaded_at?: string;
}

export interface RequestNote {
  id?: string;
  request_id?: string;
  author_id?: string | null;
  text: string;
  created_at: string;
}

export interface PersonalDocumentItem {
  id: string;
  type: string;
  name: string;
  data: string;
  uploaded_at: string;
}
