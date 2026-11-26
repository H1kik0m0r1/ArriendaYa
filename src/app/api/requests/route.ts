import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createRentalRequestSchema } from "@/lib/validators/schemas";

export async function POST(request: Request) {
  const auth = await requireApiAuth(["tenant"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = createRentalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
  }

  const { propertyId } = parsed.data;
  const { data: prop } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  const propRecord = (prop as Record<string, unknown> | null) ?? null;
  const moderationStatus =
    typeof propRecord?.moderation_status === "string" ? propRecord.moderation_status : "active";

  if (!propRecord || propRecord.status !== "published" || moderationStatus !== "active") {
    return NextResponse.json({ error: "La propiedad no está disponible para solicitudes" }, { status: 404 });
  }
  if (propRecord.owner_id === user.id) {
    return NextResponse.json({ error: "No puedes solicitar tu propia propiedad" }, { status: 400 });
  }

  const { data: activeReqs } = await supabase
    .from("rental_requests")
    .select("id, status")
    .eq("property_id", propertyId)
    .eq("tenant_id", user.id)
    .in("status", ["pending", "first_accepted", "docs_submitted", "returned", "accepted"]);

  if (activeReqs && activeReqs.length > 0) {
    return NextResponse.json({ error: "Ya tienes una solicitud activa para esta propiedad" }, { status: 409 });
  }

  const { data: created, error } = await supabase
    .from("rental_requests")
    .insert({
      property_id: propertyId,
      tenant_id: user.id,
      status: "pending",
    })
    .select("id, status")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message || "Error al crear solicitud" }, { status: 400 });
  }

  return NextResponse.json({ request: created }, { status: 201 });
}
