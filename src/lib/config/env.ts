export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && url.startsWith("http"));
}

/**
 * El modo demo solo se habilita de forma explicita con NEXT_PUBLIC_DEMO_MODE=true
 * cuando no hay backend Supabase configurado. Nunca se activa silenciosamente.
 */
export function isDemoMode(): boolean {
  if (isSupabaseConfigured()) return false;
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function getDataSourceMode(): "supabase" | "demo" | "unconfigured" {
  if (isSupabaseConfigured()) return "supabase";
  if (isDemoMode()) return "demo";
  return "unconfigured";
}
