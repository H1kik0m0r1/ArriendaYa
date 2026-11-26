import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthContext, requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const reviewCreateSchema = z.object({
  propertyId: z.string().uuid("Inmueble inválido"),
  rating: z.number().int().min(1, "Calificación mínima 1").max(5, "Calificación máxima 5"),
  comment: z.string().trim().min(5, "Escribe al menos 5 caracteres").max(1000, "Máximo 1000 caracteres"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("propertyId") || "";
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId requerido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const supabase = await createClient();
  const reader = admin ?? supabase;

  const { data: rows, error } = await reader
    .from("reviews")
    .select("id, property_id, author_id, rating, comment, created_at")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const reviewList = (rows as Array<Record<string, unknown>> | null) ?? [];
  const authorIds = Array.from(
    new Set(reviewList.map((r) => r.author_id).filter((id): id is string => typeof id === "string"))
  );

  const authorMap = new Map<string, string>();
  if (authorIds.length > 0 && admin) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    for (const p of (profiles as Array<{ id: string; full_name: string | null }> | null) ?? []) {
      authorMap.set(p.id, p.full_name || "Inquilino");
    }
  }

  let canReview = false;
  let alreadyReviewed = false;
  const authCtx = await getServerAuthContext().catch(() => null);
  if (authCtx?.user?.id) {
    alreadyReviewed = reviewList.some((r) => r.author_id === authCtx.user.id);
    if (!alreadyReviewed) {
      const { data: contract } = await authCtx.supabase
        .from("contracts")
        .select("id")
        .eq("property_id", propertyId)
        .eq("tenant_id", authCtx.user.id)
        .in("status", ["active", "expiring", "renewed", "suspended"])
        .limit(1)
        .maybeSingle();
      canReview = Boolean(contract);
    }
  }

  const reviews = reviewList.map((r) => ({
    id: String(r.id),
    property_id: String(r.property_id),
    author_id: typeof r.author_id === "string" ? r.author_id : null,
    author_name: typeof r.author_id === "string" ? (authorMap.get(r.author_id) || "Inquilino") : "Inquilino",
    rating: Number(r.rating || 0),
    comment: String(r.comment || ""),
    created_at: String(r.created_at || new Date().toISOString()),
  }));

  const avgRating =
    reviews.length > 0
      ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
      : null;

  return NextResponse.json({
    reviews,
    averageRating: avgRating,
    canReview,
    alreadyReviewed,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["tenant", "owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = reviewCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Reseña inválida" },
      { status: 400 }
    );
  }

  const { propertyId, rating, comment } = parsed.data;

  // Validar en servidor que el usuario tuvo contrato real en este inmueble
  const { data: contract } = await supabase
    .from("contracts")
    .select("id")
    .eq("property_id", propertyId)
    .eq("tenant_id", user.id)
    .in("status", ["active", "expiring", "renewed", "suspended"])
    .limit(1)
    .maybeSingle();

  if (!contract) {
    return NextResponse.json(
      { error: "Solo inquilinos con un contrato asociado a este inmueble pueden publicar reseñas." },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("property_id", propertyId)
    .eq("author_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Ya publicaste una reseña para este inmueble." },
      { status: 409 }
    );
  }

  const { data: created, error } = await supabase
    .from("reviews")
    .insert({
      property_id: propertyId,
      author_id: user.id,
      rating,
      comment,
    })
    .select("*")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message || "No se pudo guardar la reseña" },
      { status: 400 }
    );
  }

  return NextResponse.json({ review: created }, { status: 201 });
}
