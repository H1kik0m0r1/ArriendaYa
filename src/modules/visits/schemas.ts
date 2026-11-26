import { z } from "zod";
import { isPastBogotaDate } from "@/lib/date/bogota";

export const scheduleVisitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Indica tu nombre")
    .regex(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/, "Solo letras"),
  phone: z.string().trim().regex(/^\d{10}$/, "Debe tener 10 dígitos"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)")
    .refine((d) => !isPastBogotaDate(d), "No puedes programar visitas en fechas anteriores a hoy (America/Bogota)"),
});

export type ScheduleVisitValues = z.infer<typeof scheduleVisitSchema>;

export const calendarEventSchema = z
  .object({
    title: z.string().trim().min(2, "Indica un título"),
    start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de inicio inválida")
      .refine((d) => !isPastBogotaDate(d), "La fecha de inicio no puede ser anterior a hoy (America/Bogota)"),
    end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de fin inválida")
      .refine((d) => !isPastBogotaDate(d), "La fecha de fin no puede ser anterior a hoy (America/Bogota)"),
  })
  .refine((d) => d.end >= d.start, {
    message: "La fecha fin debe ser igual o posterior al inicio",
    path: ["end"],
  });

export type CalendarEventValues = z.infer<typeof calendarEventSchema>;
