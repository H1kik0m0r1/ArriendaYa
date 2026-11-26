import { z } from "zod";

export const createRentalRequestSchema = z.object({
  propertyId: z.string().uuid("Propiedad inválida"),
});

export const requestTransitionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("first_accept") }),
  z.object({ action: z.literal("first_reject"), reason: z.string().trim().min(3, "Indica el motivo del rechazo") }),
  z.object({ action: z.literal("second_accept") }),
  z.object({ action: z.literal("second_reject"), reason: z.string().trim().min(3, "Indica el motivo del rechazo") }),
  z.object({
    action: z.literal("second_return"),
    returnMessage: z.string().trim().min(3, "Indica qué documento falta o debe corregirse"),
  }),
  z.object({
    action: z.literal("submit_docs"),
    laborProfile: z.enum(["empleado", "independiente", "pensionado"]),
    hasCosigner: z.boolean(),
    cosignerRequiresProperty: z.boolean(),
    durationValue: z.number().int().positive("Indica una duración válida"),
    durationUnit: z.enum(["dias", "meses", "horas"]),
    documents: z
      .array(
        z.object({
          docType: z.string().trim().min(1),
          filePath: z.string().trim().min(1),
        })
      )
      .min(1, "Debes adjuntar al menos un documento"),
  }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().optional() }),
]);

export const requestDocsFormSchema = z.object({
  laborProfile: z.enum(["empleado", "independiente", "pensionado"]),
  hasCosigner: z.boolean(),
  cosignerRequiresProperty: z.boolean(),
  durationValue: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, "Indica la duración deseada"),
  durationUnit: z.enum(["dias", "meses", "horas"]),
});

export type RequestDocsFormValues = z.infer<typeof requestDocsFormSchema>;

export const requestNoteSchema = z.object({
  text: z.string().trim().min(1, "Escribe una observación").max(2000, "Máximo 2000 caracteres"),
});

export const documentReviewSchema = z.object({
  status: z.enum(["aprobado", "rechazado"]),
});

export const personalDocSchema = z.object({
  type: z.string().trim().min(2, "Indica el tipo de documento").max(80),
});

export type PersonalDocFormValues = z.infer<typeof personalDocSchema>;
