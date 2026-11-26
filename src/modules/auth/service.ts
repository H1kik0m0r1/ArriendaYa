import { getDataSourceMode, isDemoMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";
import { apiJsonFetch, errResult, okResult, type ServiceResult } from "@/modules/shared/service-result";
import {
  getUserRoleById,
  insertDemoInvitation,
  listDemoInvitations,
  updateOwnProfile,
} from "./repository";
import type {
  ForgotPasswordFormValues,
  LoginFormValues,
  ProfileUpdateFormValues,
  RegisterFormValues,
  ResetPasswordFormValues,
} from "./schemas";
import type { OwnerInvitation, Role } from "./types";

export function resolveHomeRouteForRole(role: Role | null): string {
  if (role === "owner") return "/owner/dashboard";
  if (role === "admin") return "/admin";
  if (role === "tenant") return "/tenant/dashboard";
  return "/";
}

export async function logoutSession(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  if (!isDemoMode()) {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  }
}

export async function loginWithPassword(
  values: LoginFormValues,
  nextPath?: string
): Promise<ServiceResult<{ redirectTo: string }>> {
  const supabase = createClient();
  const mode = getDataSourceMode();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("banned") || msg.includes("suspend")) {
      return errResult("Tu cuenta está suspendida. Contacta al administrador.");
    }
    return errResult(
      mode === "unconfigured" ? error.message : "Correo o contraseña incorrectos"
    );
  }

  const userId = data.user?.id;
  if (userId) {
    const { data: rawProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    const record = (rawProfile as Record<string, unknown> | null) ?? null;
    if (typeof record?.suspended_at === "string" && record.suspended_at) {
      await supabase.auth.signOut().catch(() => {});
      return errResult("Tu cuenta está suspendida. Contacta al administrador.");
    }
    if (nextPath) {
      return okResult({ redirectTo: nextPath });
    }
    const role = (record?.role as Role | undefined) ?? (await getUserRoleById(userId));
    return okResult({ redirectTo: resolveHomeRouteForRole(role) });
  }

  if (nextPath) {
    return okResult({ redirectTo: nextPath });
  }

  return okResult({ redirectTo: resolveHomeRouteForRole(null) });
}

export async function registerAccount(
  values: RegisterFormValues
): Promise<ServiceResult<{ requiresEmailConfirmation: boolean }>> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: {
        full_name: values.fullName,
        phone: values.phone,
        accepted_terms: true,
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    return errResult(error.message || "No se pudo crear la cuenta");
  }

  return okResult({
    requiresEmailConfirmation: Boolean(data.user && !data.session),
  });
}

export async function requestPasswordReset(
  values: ForgotPasswordFormValues
): Promise<ServiceResult<true>> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
  });
  if (error) return errResult(error.message);
  return okResult(true);
}

export async function updateUserPassword(
  values: ResetPasswordFormValues
): Promise<ServiceResult<true>> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: values.password });
  if (error) return errResult(error.message);
  return okResult(true);
}

export async function saveOwnProfile(
  values: ProfileUpdateFormValues
): Promise<ServiceResult<true>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errResult("No autenticado");

  const { error } = await updateOwnProfile(user.id, values.fullName, values.phone);
  if (error) return errResult(error.message);
  return okResult(true);
}

export async function fetchOwnerInvitations(): Promise<ServiceResult<OwnerInvitation[]>> {
  if (isDemoMode()) {
    return okResult(await listDemoInvitations());
  }
  const res = await apiJsonFetch<{ invitations?: OwnerInvitation[] }>("/api/admin/invitations");
  if (!res.ok) return res;
  return okResult(res.data.invitations || []);
}

export async function createOwnerInvitation(
  email: string
): Promise<ServiceResult<{ email: string }>> {
  if (isDemoMode()) {
    const normalized = email.trim().toLowerCase();
    const { error } = await insertDemoInvitation(normalized);
    if (error) return errResult(error.message);
    return okResult({ email: normalized });
  }
  const res = await apiJsonFetch<{ email?: string }>("/api/admin/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return res;
  return okResult({ email: res.data.email || email });
}
