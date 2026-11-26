import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import * as localdb from "./localdb";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !url.startsWith("http")) {
    return localdb.createClient();
  }
  const cookieStore = await cookies();
  return createSSRClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {}
      },
    },
  });
}
export { createClient as createServerClient };
