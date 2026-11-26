"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "./types";

export interface SessionHeaderProfile {
  id: string;
  full_name: string | null;
  role: Role;
}

export function useSessionProfile() {
  const [profile, setProfile] = useState<SessionHeaderProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    const syncProfile = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        if (mounted) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      const record = (p as Record<string, unknown> | null) ?? null;
      if (typeof record?.suspended_at === "string" && record.suspended_at) {
        await supabase.auth.signOut().catch(() => {});
        if (mounted) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      if (mounted) {
        setProfile(
          record
            ? {
                id: String(record.id),
                full_name: typeof record.full_name === "string" ? record.full_name : null,
                role: record.role as Role,
              }
            : null
        );
        setLoading(false);
      }
    };

    void syncProfile();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void syncProfile();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { profile, loading, clearProfile: () => setProfile(null) };
}
