import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Formato inválido (ej: usuario@correo.com)"),
  password: z.string().min(1, "Requerido"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const strongPasswordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Debe incluir al menos una letra mayúscula")
  .regex(/[a-z]/, "Debe incluir al menos una letra minúscula")
  .regex(/\d/, "Debe incluir al menos un número");

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .regex(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/, "Solo letras"),
  phone: z.string().trim().regex(/^\d{10}$/, "Debe tener exactamente 10 dígitos"),
  email: z.string().trim().email("Formato inválido (ej: usuario@correo.com)"),
  password: strongPasswordSchema,
  terms: z.boolean().refine((v) => v, "Debes aceptar los términos"),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Formato inválido (ej: usuario@correo.com)"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirma la contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .regex(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/, "Solo letras"),
  phone: z.string().trim().regex(/^\d{10}$/, "Debe tener exactamente 10 dígitos"),
});

export type ProfileUpdateFormValues = z.infer<typeof profileUpdateSchema>;

export const ownerInvitationSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  expiresInDays: z.coerce.number().int().min(1).max(90).optional(),
});

export type OwnerInvitationFormValues = z.infer<typeof ownerInvitationSchema>;

export function safeRedirectPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }
  return trimmed;
}

export function evaluatePasswordStrength(password: string): {
  level: number;
  label: string;
  color: string;
} {
  if (!password) return { level: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { level: 1, label: "Bajo", color: "text-red-600" };
  if (score === 2) return { level: 2, label: "Medio", color: "text-yellow-600" };
  return { level: 3, label: "Alto", color: "text-green-600" };
}
