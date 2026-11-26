import { z } from "zod";

export const contractTermsSchema = z
  .object({
    terms: z.string().trim().min(10, "Los términos deben tener al menos 10 caracteres"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de inicio inválida"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de fin inválida"),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "La fecha de fin debe ser posterior a la de inicio",
    path: ["endDate"],
  });

export type ContractTermsValues = z.infer<typeof contractTermsSchema>;

export const contractSignSchema = z.object({
  signatureDataUrl: z.string().startsWith("data:image/png;base64,", "Firma PNG inválida"),
});

export const contractLifecycleSchema = z.object({
  action: z.enum(["renew", "suspend"]),
});
