import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function validateFile(file: File, maxSizeMB: number, allowedTypes: string[]): { valid: boolean; error?: string } {
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `El archivo supera ${maxSizeMB}MB` };
  }
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `Tipo no permitido. Permitidos: ${allowedTypes.join(", ")}` };
  }
  return { valid: true };
}

export function isValidVideoUrl(url: string): boolean {
  if (!url) return true;
  try {
    const u = new URL(url);
    const allowed = ["youtube.com", "youtu.be", "vimeo.com"];
    return allowed.some((d) => u.hostname.includes(d));
  } catch {
    return false;
  }
}
