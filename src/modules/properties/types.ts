export type PropertyType =
  | "Apartamento"
  | "Casa"
  | "Habitación"
  | "Estudio"
  | "Cabaña"
  | "Finca"
  | "Local comercial"
  | "Oficina"
  | "Bodega";

export type RentalType = "vivienda" | "recreativo";
export type PricePeriod = "mes" | "dia" | "hora";
export type PropertyStatus =
  | "draft"
  | "published"
  | "rented"
  | "paused"
  | "maintenance"
  | "archived"
  | "in_process";

export type PropertyModerationStatus = "active" | "paused_by_admin" | "suspended";

export interface PropertyImage {
  id: string;
  property_id?: string;
  url: string;
  sort_order: number;
  label?: string;
}

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
  moderation_status?: PropertyModerationStatus;
  moderation_reason?: string | null;
  moderated_at?: string | null;
  moderated_by?: string | null;
  created_at: string;
  updated_at: string;
  property_images?: PropertyImage[];
}

export interface PropertyFilters {
  q?: string;
  type?: string;
  priceMin?: string;
  priceMax?: string;
  rentalType?: string;
  petsAllowed?: boolean;
  furnished?: string;
  sort?: "recent" | "price_asc" | "price_desc";
  page?: number;
  pageSize?: number;
  skipPagination?: boolean;
}

export interface PropertyCoordinateItem {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface SavedPropertyList {
  id: string;
  user_id: string;
  name: string;
  created_at?: string;
  property_ids?: string[];
}
