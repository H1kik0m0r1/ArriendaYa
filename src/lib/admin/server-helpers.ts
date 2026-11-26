import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiAuth, type AuthenticatedContext } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/modules/auth/types";
import type { AdminAuditItem } from "@/modules/admin/types";

export async function requireAdminService(): Promise<
  | { ok: true; ctx: AuthenticatedContext; admin: SupabaseClient }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireApiAuth(["admin"]);
  if (!auth.ok) return auth;

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Falta SUPABASE_SERVICE_ROLE_KEY para operar el panel administrativo." },
        { status: 503 }
      ),
    };
  }

  return { ok: true, ctx: auth.ctx, admin };
}

export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204";
}

export async function enrichAuditLogs(
  admin: SupabaseClient,
  rawLogs: Array<Record<string, unknown>>
): Promise<AdminAuditItem[]> {
  if (!rawLogs.length) return [];

  const actorIds = Array.from(
    new Set(rawLogs.map((l) => l.user_id).filter((id): id is string => typeof id === "string" && id.length > 0))
  );

  const actorMap = new Map<string, { full_name: string | null; email: string | null; role: Role | null }>();
  if (actorIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email, role")
      .in("id", actorIds);
    for (const p of (profiles as Array<Record<string, unknown>> | null) ?? []) {
      actorMap.set(String(p.id), {
        full_name: typeof p.full_name === "string" ? p.full_name : null,
        email: typeof p.email === "string" ? p.email : null,
        role: (p.role as Role) ?? null,
      });
    }
  }

  return rawLogs.map((row) => {
    const userId = typeof row.user_id === "string" ? row.user_id : null;
    const actor = userId ? actorMap.get(userId) : undefined;
    const resVal = row.result;
    const result: "success" | "denied" | "error" =
      resVal === "denied" || resVal === "error" ? resVal : "success";

    return {
      id: String(row.id),
      user_id: userId,
      actor_name: actor?.full_name ?? null,
      actor_email: actor?.email ?? null,
      actor_role: actor?.role ?? null,
      action: String(row.action || ""),
      entity: typeof row.entity === "string" ? row.entity : null,
      target_type: typeof row.target_type === "string" ? row.target_type : null,
      target_id: typeof row.target_id === "string" ? row.target_id : null,
      result,
      details:
        row.details && typeof row.details === "object" && !Array.isArray(row.details)
          ? (row.details as Record<string, unknown>)
          : {},
      created_at: String(row.created_at || new Date().toISOString()),
    };
  });
}
