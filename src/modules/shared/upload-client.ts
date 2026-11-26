import { PRIVATE_BUCKET_RULES, type PrivateBucket } from "@/lib/storage/private-files";
import { validateFile } from "@/lib/utils";
import { apiJsonFetch, errResult, okResult, type ServiceResult } from "./service-result";

export async function uploadPrivateFile(
  bucket: Exclude<PrivateBucket, "signatures">,
  entityId: string,
  file: File
): Promise<ServiceResult<string>> {
  const rules = PRIVATE_BUCKET_RULES[bucket];
  const validation = validateFile(file, rules.maxSizeBytes / (1024 * 1024), rules.allowedMimeTypes);
  if (!validation.valid) {
    return errResult(validation.error || "Archivo inválido");
  }

  const fd = new FormData();
  fd.append("bucket", bucket);
  fd.append("entityId", entityId);
  fd.append("file", file);

  const res = await apiJsonFetch<{ path?: string }>("/api/storage/upload", {
    method: "POST",
    body: fd,
  });
  if (!res.ok) return res;
  if (!res.data.path) {
    return errResult("No se recibió la ruta del archivo subido");
  }
  return okResult(res.data.path);
}
