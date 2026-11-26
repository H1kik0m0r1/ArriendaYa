export const BOGOTA_TIMEZONE = "America/Bogota";

/**
 * Devuelve la fecha actual en zona horaria America/Bogota en formato YYYY-MM-DD.
 */
export function getBogotaTodayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

export function isPastBogotaDate(dateIso: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return true;
  return dateIso < getBogotaTodayIso(now);
}
