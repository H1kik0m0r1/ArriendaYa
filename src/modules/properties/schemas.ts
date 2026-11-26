import { z } from "zod";
import { isValidVideoUrl } from "@/lib/utils";

const positiveIntString = (msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, msg);

const positiveNumberString = (msg: string) =>
  z
    .string()
    .trim()
    .refine((v) => v.length > 0 && Number.isFinite(Number(v)) && Number(v) > 0, msg);

export const propertySchema = z.object({
  name: z.string().trim().min(1, "Requerido"),
  type: z.string().min(1, "Requerido"),
  max_people: z.coerce.number().int().positive("Debe ser mayor a cero"),
  area_sqm: z.coerce.number().positive("Debe ser mayor a cero"),
  location: z.string().trim().min(1, "Requerido"),
  description: z.string().optional(),
  rental_type: z.enum(["vivienda", "recreativo"]),
  price: z.coerce.number().positive("Debe ser mayor a cero"),
});

export const propertyWizardSchema = z.object({
  name: z.string().trim().min(2, "Indica un nombre válido"),
  type: z.string().min(1, "Requerido"),
  location: z.string().trim().min(2, "Indica la ubicación"),
  rental_type: z.enum(["vivienda", "recreativo"]),
  max_people: positiveIntString("Mínimo 1 persona"),
  description: z.string(),
  area_sqm: positiveNumberString("Indica los m²"),
  price: positiveNumberString("Indica un precio válido"),
  price_period: z.enum(["mes", "dia", "hora"]),
  address: z.string(),
  contact_phone: z
    .string()
    .trim()
    .refine((v) => !v || /^\d{10}$/.test(v), "Debe tener 10 dígitos"),
});

export type PropertyWizardValues = z.infer<typeof propertyWizardSchema>;

export const propertyEditSchema = z
  .object({
    name: z.string().trim().min(2, "El nombre es obligatorio"),
    type: z.string().min(1, "Requerido"),
    max_people: positiveIntString("Mínimo 1 persona"),
    area_sqm: positiveNumberString("Debe ser mayor a 0"),
    location: z.string().trim().min(2, "La ubicación es obligatoria"),
    description: z.string(),
    rental_type: z.enum(["vivienda", "recreativo"]),
    has_max_days: z.boolean(),
    max_rental_days: z.string(),
    price: positiveNumberString("El precio debe ser mayor a 0"),
    price_period: z.enum(["mes", "dia", "hora"]),
    contact_phone: z
      .string()
      .trim()
      .refine((v) => !v || /^\d{10}$/.test(v), "Debe tener 10 dígitos"),
    contact_email: z
      .string()
      .trim()
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Correo inválido"),
    contact_social: z.string(),
    discount_percent: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 95), "Entre 0 y 95%"),
    discount_until: z.string(),
    address: z.string(),
    includes_administration: z.boolean(),
    administration_fee: z.string(),
    parking: z.string(),
    floor_area: z.string(),
    condition: z.enum(["nueva", "usada"]),
    stratum: z.string(),
    nearby_centers: z.string(),
    available_from: z.string(),
    requires_cosigner: z.boolean(),
    deposit_months: z.string(),
    renter_type: z.enum(["inmobiliaria", "dueño directo"]),
    renter_name: z.string(),
    furnished: z.enum(["amoblado", "semi", "sin amoblar"]),
    pets_allowed: z.boolean(),
    for_new: z.boolean(),
    video_url: z.string().trim().refine((v) => isValidVideoUrl(v), "Usa una URL de YouTube o Vimeo"),
    whatsapp_contact: z.string(),
  })
  .refine(
    (v) => !v.has_max_days || !v.max_rental_days || Number(v.max_rental_days) > 0,
    { message: "Indica un máximo de días válido", path: ["max_rental_days"] }
  );

export type PropertyEditValues = z.infer<typeof propertyEditSchema>;

export const savedListSchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(60, "Máximo 60 caracteres"),
});

export type SavedListValues = z.infer<typeof savedListSchema>;
