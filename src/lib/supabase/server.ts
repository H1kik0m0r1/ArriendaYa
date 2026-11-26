import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config/env";
import * as localdb from "./localdb";
import { createUnconfiguredClient } from "./unconfigured";
import type { AppSupabaseClient } from "./client";

export async function createClient(): Promise<AppSupabaseClient> {
  if (!isSupabaseConfigured()) {
    if (isDemoMode()) {
      return localdb.createClient() as unknown as AppSupabaseClient;
    }
    return createUnconfiguredClient() as unknown as AppSupabaseClient;
  }

  const cookieStore = await cookies();
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // En Server Components de solo lectura Next.js ignora setAll
          }
        },
      },
    }
  );
}

export { createClient as createServerClient };
