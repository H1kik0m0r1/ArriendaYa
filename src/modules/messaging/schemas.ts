import { z } from "zod";

export const createConversationSchema = z.object({
  tenantEmail: z.string().trim().email("Correo de inquilino inválido"),
});

export type CreateConversationValues = z.infer<typeof createConversationSchema>;

export const messageCreateSchema = z.object({
  text: z.string().trim().min(1, "Escribe un mensaje").max(2000, "Máximo 2000 caracteres"),
});

export type MessageCreateValues = z.infer<typeof messageCreateSchema>;
