import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const useSupabase = !!(SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith("http"));

export function createClient(): any {
  if (useSupabase) {
    return createBrowserClient(SUPABASE_URL!, SUPABASE_KEY!);
  }
  // fallback to local (lazy require)
  const mod = require("./localdb");
  return mod.createClient();
}

export { createClient as createBrowserClient };

export const createServerClient = () => createClient();
