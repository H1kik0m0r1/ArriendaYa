import { z } from "zod";

export const reportCreateSchema = z.object({
  reason: z.string().trim().min(3, "Indica el motivo del reporte (mínimo 3 caracteres)").max(160),
  description: z.string().trim().min(10, "Describe el problema con al menos 10 caracteres").max(2000),
  propertyId: z.string().optional(),
});

export type ReportCreateValues = z.infer<typeof reportCreateSchema>;

export const reportResponseSchema = z.object({
  response: z.string().trim().min(3, "La respuesta debe tener al menos 3 caracteres").max(2000),
});

export type ReportResponseValues = z.infer<typeof reportResponseSchema>;
