import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { propertySchema } from "@/modules/properties/schemas";

const createPropertyPayloadSchema = propertySchema.extend({
  price_period: z.enum(["mes", "dia", "hora"]).default("mes"),
  address: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = createPropertyPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos del inmueble inválidos" },
      { status: 400 }
    );
  }

  // Al crear inicialmente nunca se permite publicar sin las 4 fotografías previas en property_images
  if (parsed.data.status === "published") {
    return NextResponse.json(
      {
        error:
          "Se requieren al menos 4 fotografías cargadas antes de publicar un inmueble nuevo.",
      },
      { status: 400 }
    );
  }

  const { data: created, error } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      max_people: parsed.data.max_people,
      area_sqm: parsed.data.area_sqm,
      location: parsed.data.location,
      description: parsed.data.description || null,
      rental_type: parsed.data.rental_type,
      price: parsed.data.price,
      price_period: parsed.data.price_period,
      address: parsed.data.address || null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      contact_phone: parsed.data.contact_phone || null,
      status: "draft",
    })
    .select("*")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message || "No se pudo crear el borrador del inmueble" },
      { status: 400 }
    );
  }

  return NextResponse.json({ property: created }, { status: 201 });
}
