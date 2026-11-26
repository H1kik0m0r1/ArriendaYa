import { createClient } from "@/lib/supabase/client";
import type { OwnerInvitation, Profile, Role } from "./types";

export async function getCurrentAuthUser(): Promise<{ id: string; email: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email || "" };
}

export async function getCurrentUserProfile(): Promise<{
  user: { id: string; email: string } | null;
  profile: Profile | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    user: { id: user.id, email: user.email || "" },
    profile: (profile as Profile | null) ?? null,
  };
}

export async function getUserRoleById(userId: string): Promise<Role | null> {
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return (data?.role as Role | undefined) ?? null;
}

export async function updateOwnProfile(userId: string, fullName: string, phone: string) {
  const supabase = createClient();
  return supabase
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", userId);
}

export async function listDemoInvitations(): Promise<OwnerInvitation[]> {
  const supabase = createClient();
  const { data } = await supabase.from("owner_invitations").select("*");
  return (data as OwnerInvitation[] | null) ?? [];
}

export async function insertDemoInvitation(email: string) {
  const supabase = createClient();
  return supabase.from("owner_invitations").insert({
    email: email.trim().toLowerCase(),
    invited_by: null,
    expires_at: null,
    used_at: null,
  });
}
