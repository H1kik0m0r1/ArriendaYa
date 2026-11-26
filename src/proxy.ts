import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isDemoMode, isSupabaseConfigured } from "@/lib/config/env";
import type { Role } from "@/lib/types";

const PROTECTED_PREFIXES = ["/owner", "/tenant", "/admin", "/profile", "/contracts", "/notifications", "/settings"];

function getHomePath(role: Role): string {
  if (role === "owner") return "/owner/dashboard";
  if (role === "admin") return "/admin";
  return "/tenant/dashboard";
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/" && request.nextUrl.searchParams.has("code")) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isSupabaseConfigured()) {
    if (isProtected && !isDemoMode()) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("error", "config");
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isProtected) {
    const { data: rawProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const profileRecord = (rawProfile as Record<string, unknown> | null) ?? null;
    const role = profileRecord?.role as Role | undefined;
    const suspendedAt =
      typeof profileRecord?.suspended_at === "string" ? profileRecord.suspended_at : null;
    const bannedUntil = (user as { banned_until?: string | null }).banned_until ?? null;
    const isBanned = Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());

    if (suspendedAt || isBanned) {
      await supabase.auth.signOut().catch(() => {});
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("error", "suspended");
      const redirectResponse = NextResponse.redirect(loginUrl);
      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      }
      return redirectResponse;
    }

    if (path.startsWith("/owner") || path.startsWith("/tenant") || path.startsWith("/admin")) {
      if (!role) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("error", "profile");
        return NextResponse.redirect(loginUrl);
      }
      if (path.startsWith("/owner") && role !== "owner") {
        const target = request.nextUrl.clone();
        target.pathname = getHomePath(role);
        return NextResponse.redirect(target);
      }
      if (path.startsWith("/tenant") && role !== "tenant") {
        const target = request.nextUrl.clone();
        target.pathname = getHomePath(role);
        return NextResponse.redirect(target);
      }
      if (path.startsWith("/admin") && role !== "admin") {
        const target = request.nextUrl.clone();
        target.pathname = getHomePath(role);
        return NextResponse.redirect(target);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
