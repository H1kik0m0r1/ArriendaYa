import { isDemoMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";

export type PrivateBucket = "request-documents" | "signatures" | "payment-receipts" | "identity-documents";

export const PRIVATE_BUCKET_RULES: Record<
  PrivateBucket,
  { maxSizeBytes: number; allowedMimeTypes: string[] }
> = {
  "request-documents": {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
  signatures: {
    maxSizeBytes: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/png"],
  },
  "payment-receipts": {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
  "identity-documents": {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
};

export function mimeToSafeExtension(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export function hasValidMagicBytes(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 4) return false;
  if (mime === "application/pdf") {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  }
  if (mime === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mime === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}

/**
 * Normaliza un valor guardado en BD (ruta de storage o URL firmada historica)
 * para obtener una URL firmada efimera desde el servidor previa verificacion de permisos.
 */
export async function resolvePrivateFileUrl(bucket: PrivateBucket, storedValue: string): Promise<string | null> {
  if (!storedValue) return null;
  if (storedValue.startsWith("data:")) return storedValue;

  if (isDemoMode()) {
    const supabase = createClient();
    const { data } = await supabase.storage.from(bucket).createSignedUrl(storedValue, 120);
    return data?.signedUrl || null;
  }

  let objectPath = storedValue;
  if (storedValue.startsWith("http")) {
    const marker = `/storage/v1/object/sign/${bucket}/`;
    const idx = storedValue.indexOf(marker);
    if (idx !== -1) {
      objectPath = decodeURIComponent(storedValue.slice(idx + marker.length).split("?")[0]);
    } else {
      return storedValue;
    }
  }

  const res = await fetch("/api/storage/signed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, path: objectPath }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { signedUrl?: string };
  return json.signedUrl || null;
}
