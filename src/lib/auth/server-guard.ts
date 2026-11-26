import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config/env";
import type { Role } from "@/lib/types";

export interface AuthenticatedContext {
  user: { id: string; email: string | null; banned_until?: string | null };
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    role: Role;
    suspended_at: string | null;
    suspended_reason: string | null;
  };
  supabase: Awaited<ReturnType<typeof createClient>>;
}

function isUserSuspended(ctx: AuthenticatedContext): boolean {
  if (ctx.profile.suspended_at) return true;
  if (ctx.user.banned_until) {
    const bannedMs = new Date(ctx.user.banned_until).getTime();
    if (!Number.isNaN(bannedMs) && bannedMs > Date.now()) return true;
  }
  return false;
}

export async function getServerAuthContext(): Promise<AuthenticatedContext | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!rawProfile) return null;
  const record = rawProfile as Record<string, unknown>;
  const bannedUntil = (user as { banned_until?: string | null }).banned_until ?? null;

  return {
    user: { id: user.id, email: user.email ?? null, banned_until: bannedUntil },
    profile: {
      id: String(record.id),
      email: String(record.email || user.email || ""),
      full_name: typeof record.full_name === "string" ? record.full_name : null,
      role: record.role as Role,
      suspended_at: typeof record.suspended_at === "string" ? record.suspended_at : null,
      suspended_reason: typeof record.suspended_reason === "string" ? record.suspended_reason : null,
    },
    supabase,
  };
}

export function getHomePathForRole(role: Role): string {
  if (role === "owner") return "/owner/dashboard";
  if (role === "admin") return "/admin";
  return "/tenant/dashboard";
}

export async function requirePageRole(allowedRoles: Role[]) {
  if (!isSupabaseConfigured()) {
    if (isDemoMode()) return null;
    redirect("/login?error=config");
  }

  const ctx = await getServerAuthContext();
  if (!ctx) {
    redirect("/login");
  }
  if (isUserSuspended(ctx)) {
    await ctx.supabase.auth.signOut().catch(() => {});
    redirect("/login?error=suspended");
  }
  if (!allowedRoles.includes(ctx.profile.role)) {
    redirect(getHomePathForRole(ctx.profile.role));
  }
  return ctx;
}

export async function requireApiAuth(
  allowedRoles?: Role[]
): Promise<{ ok: true; ctx: AuthenticatedContext } | { ok: false; response: NextResponse }> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Supabase no está configurado en el servidor." },
        { status: 503 }
      ),
    };
  }

  const ctx = await getServerAuthContext();
  if (!ctx) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  if (isUserSuspended(ctx)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Tu cuenta está suspendida. Contacta al administrador.",
          code: "ACCOUNT_SUSPENDED",
        },
        { status: 403 }
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(ctx.profile.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado para esta operación" }, { status: 403 }),
    };
  }

  return { ok: true, ctx };
}
