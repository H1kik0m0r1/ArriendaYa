import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key && url.startsWith("http")) {
    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;
    const protectedPrefixes = ["/owner", "/tenant", "/profile", "/contracts", "/notifications", "/settings"];
    const isProtected = protectedPrefixes.some((p) => path.startsWith(p));
    if (isProtected && !user) {
      const u = request.nextUrl.clone();
      u.pathname = "/login";
      u.searchParams.set("next", path);
      return NextResponse.redirect(u);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
