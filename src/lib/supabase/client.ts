import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config/env";
import * as localdb from "./localdb";
import { createUnconfiguredClient } from "./unconfigured";

export type AppSupabaseClient = ReturnType<typeof createSSRBrowserClient>;

export function createClient(): AppSupabaseClient {
  if (isSupabaseConfigured()) {
    return createSSRBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  if (isDemoMode()) {
    return localdb.createClient() as unknown as AppSupabaseClient;
  }
  return createUnconfiguredClient() as unknown as AppSupabaseClient;
}

export { createClient as createBrowserClient };
