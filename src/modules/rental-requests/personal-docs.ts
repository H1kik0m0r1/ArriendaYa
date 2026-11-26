import { validateFile } from "@/lib/utils";
import { errResult, okResult, type ServiceResult } from "@/modules/shared/service-result";
import type { PersonalDocumentItem } from "./types";

const PERSONAL_DOCS_KEY = "arriendaya_personal_docs";

export function loadPersonalDocuments(): PersonalDocumentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PERSONAL_DOCS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as PersonalDocumentItem[]) : [];
  } catch {
    return [];
  }
}

export function deletePersonalDocument(id: string): PersonalDocumentItem[] {
  const next = loadPersonalDocuments().filter((d) => d.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(PERSONAL_DOCS_KEY, JSON.stringify(next));
  }
  return next;
}

export function addPersonalDocument(
  type: string,
  file: File
): Promise<ServiceResult<PersonalDocumentItem[]>> {
  const validation = validateFile(file, 10, ["application/pdf", "image/jpeg", "image/png"]);
  if (!validation.valid) {
    return Promise.resolve(errResult(validation.error || "Archivo inválido"));
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const current = loadPersonalDocuments();
      const next: PersonalDocumentItem[] = [
        ...current,
        {
          id: Date.now().toString(),
          type: type.trim(),
          name: file.name,
          data: String(reader.result || ""),
          uploaded_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(PERSONAL_DOCS_KEY, JSON.stringify(next));
      resolve(okResult(next));
    };
    reader.onerror = () => resolve(errResult("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
