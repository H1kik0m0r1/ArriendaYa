import { z } from "zod";

export const userStatusActionSchema = z
  .object({
    action: z.enum(["suspend", "reactivate"]),
    reason: z.string().trim().max(400, "Máximo 400 caracteres").optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === "suspend" && (!val.reason || val.reason.length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Indica un motivo de suspensión de al menos 5 caracteres.",
      });
    }
  });

export const propertyModerationSchema = z
  .object({
    action: z.enum(["pause", "suspend", "restore"]),
    reason: z.string().trim().max(400, "Máximo 400 caracteres").optional(),
  })
  .superRefine((val, ctx) => {
    if ((val.action === "pause" || val.action === "suspend") && (!val.reason || val.reason.length < 5)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Indica un motivo de moderación de al menos 5 caracteres.",
      });
    }
  });

export const ownerVerificationReviewSchema = z.object({
  status: z.enum(["pendiente", "en_revision", "verificado", "rechazado"]),
  email_verified: z.boolean().optional(),
  phone_verified: z.boolean().optional(),
  notes: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
});

export const adminReportUpdateSchema = z
  .object({
    status: z.enum(["pendiente", "en_revision", "respondido", "resuelto", "desestimado"]).optional(),
    response: z.string().trim().max(1000, "Máximo 1000 caracteres").optional(),
  })
  .refine((val) => Boolean(val.status || (val.response && val.response.length >= 4)), {
    message: "Indica una respuesta válida o un nuevo estado.",
  });

export type UserStatusActionValues = z.infer<typeof userStatusActionSchema>;
export type PropertyModerationValues = z.infer<typeof propertyModerationSchema>;
export type OwnerVerificationReviewValues = z.infer<typeof ownerVerificationReviewSchema>;
export type AdminReportUpdateValues = z.infer<typeof adminReportUpdateSchema>;
