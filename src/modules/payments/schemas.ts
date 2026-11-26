import { z } from "zod";

export const paymentCreateSchema = z.object({
  contractId: z.string().uuid("Contrato inválido"),
  amount: z.coerce.number().positive("El monto debe ser mayor a cero"),
  concept: z.string().trim().min(2, "Indica el concepto del pago").max(200),
  receiptPath: z.string().trim().optional(),
});

export const paymentFormSchema = z.object({
  contractId: z.string().min(1, "Selecciona un contrato"),
  amount: z
    .string()
    .trim()
    .refine((v) => v.length > 0 && Number.isFinite(Number(v)) && Number(v) > 0, "El monto debe ser mayor a cero"),
  concept: z.string().trim().min(2, "Indica el concepto del pago").max(200),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export const paymentConfirmSchema = z.object({
  status: z.enum(["confirmado", "rechazado"]),
});

export const expenseFormSchema = z.object({
  propertyId: z.string().min(1, "Selecciona un inmueble"),
  type: z.string().trim().min(2, "Indica el tipo de gasto").max(120),
  amount: z
    .string()
    .trim()
    .refine((v) => v.length > 0 && Number.isFinite(Number(v)) && Number(v) > 0, "El monto debe ser mayor a cero"),
  period: z.string().trim().min(2, "Indica el período (ej. 2026-11)").max(40),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
