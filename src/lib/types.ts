export type Role = "owner" | "tenant";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  avatar_url: string | null;
  accepted_terms: boolean;
  created_at: string;
  updated_at: string;
}

export type PropertyType =
  | "Apartamento" | "Casa" | "Habitación" | "Estudio" | "Cabaña" | "Finca" | "Local comercial" | "Oficina" | "Bodega";

export type RentalType = "vivienda" | "recreativo";
export type PricePeriod = "mes" | "dia" | "hora";
export type PropertyStatus = "draft" | "published" | "rented" | "paused" | "maintenance" | "archived" | "in_process";

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  type: PropertyType;
  max_people: number;
  area_sqm: number;
  location: string;
  description: string | null;
  rental_type: RentalType;
  max_rental_days: number | null;
  price: number;
  price_period: PricePeriod;
  contact_phone: string | null;
  contact_email: string | null;
  contact_social: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  // nuevos campos (opcionales, no invasivos)
  includes_administration?: boolean | null;
  administration_fee?: number | null;
  parking?: number | null;
  floor_area?: number | null;
  condition?: "nueva" | "usada" | null;
  stratum?: number | null;
  nearby_centers?: string | null;
  available_from?: string | null;
  requires_cosigner?: boolean | null;
  deposit_months?: number | null;
  renter_type?: "inmobiliaria" | "dueño directo" | null;
  renter_name?: string | null;
  renter_photo_url?: string | null;
  furnished?: "amoblado" | "sin amoblar" | "semi" | null;
  pets_allowed?: boolean | null;
  for_new?: boolean | null;
  video_url?: string | null;
  image_labels?: Record<string, string> | null;
  reviews?: { author: string; rating: number; comment: string; date: string }[] | null;
  whatsapp_contact?: string | null;
  discount_percent: number;
  discount_until: string | null;
  status: PropertyStatus;
  created_at: string;
  updated_at: string;
  property_images?: { id: string; url: string; sort_order: number; label?: string }[];
}

export type RequestStatus =
  | "pending" | "first_accepted" | "docs_submitted" | "returned" | "accepted" | "rejected" | "expired" | "property_rented";

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

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}
