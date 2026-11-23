import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Formato inválido (ej: example@gmail.com)"),
  password: z.string().min(1, "Requerido"),
});

export const registerSchema = z.object({
  fullName: z.string().min(1, "Requerido").regex(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/, "Solo letras"),
  phone: z.string().regex(/^\d{10}$/, "10 dígitos"),
  email: z.string().email("Formato inválido (ej: example@gmail.com)"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  terms: z.boolean().refine((v) => v, "Debes aceptar los términos"),
});

export const propertySchema = z.object({
  name: z.string().min(1, "Requerido"),
  type: z.string().min(1),
  max_people: z.coerce.number().int().positive(),
  area_sqm: z.coerce.number().positive(),
  location: z.string().min(1, "Requerido"),
  description: z.string().optional(),
  rental_type: z.enum(["vivienda", "recreativo"]),
  price: z.coerce.number().positive(),
});
