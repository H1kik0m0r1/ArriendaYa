import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuditResult = "success" | "denied" | "error";

export interface AuditEventInput {
  actorId: string | null;
  action: string;
  entity: string;
  targetType?: string | null;
  targetId?: string | null;
  result?: AuditResult;
  details?: Record<string, unknown>;
}

const SENSITIVE_KEY_PATTERN =
  /pass|password|token|secret|key|cookie|auth|authorization|signedurl|signature_url|identity_doc|document_url|access|refresh|jwt/i;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 237)}...` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 15).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) continue;
      out[k] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 120);
}

/**
 * Registra eventos administrativos en `activity_log` exclusivamente desde el servidor
 * sin almacenar secretos, tokens, contraseñas ni documentos privados.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const safeDetails = input.details
    ? (sanitizeValue(input.details) as Record<string, unknown>)
    : {};

  const fullPayload = {
    user_id: input.actorId,
    action: input.action,
    entity: input.entity,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    result: input.result ?? "success",
    details: safeDetails,
  };

  const { error } = await admin.from("activity_log").insert(fullPayload);
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    await admin.from("activity_log").insert({
      user_id: input.actorId,
      action: input.action,
      entity: input.entity,
    });
  }
}
