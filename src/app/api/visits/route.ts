import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { insertServerNotifications } from "@/lib/notifications/server-notify";
import { scheduleVisitSchema } from "@/modules/visits/schemas";

const visitPayloadSchema = scheduleVisitSchema.extend({
  propertyId: z.string().uuid("Propiedad inválida"),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth(["tenant", "owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = visitPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos de visita inválidos" },
      { status: 400 }
    );
  }

  const { propertyId, name, phone, date } = parsed.data;
  const { data: prop } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();

  const record = (prop as Record<string, unknown> | null) ?? null;
  const moderationStatus =
    typeof record?.moderation_status === "string" ? record.moderation_status : "active";

  if (!record || record.status !== "published" || moderationStatus !== "active") {
    return NextResponse.json({ error: "La propiedad no está disponible para visitas" }, { status: 404 });
  }
  if (record.owner_id === user.id) {
    return NextResponse.json({ error: "No puedes agendar una visita en tu propia propiedad." }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from("visits")
    .insert({
      property_id: propertyId,
      tenant_id: user.id,
      name,
      phone,
      date,
      papers: null,
      status: "solicitada",
    })
    .select("*")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message || "No se pudo agendar la visita" }, { status: 400 });
  }

  await insertServerNotifications([
    {
      user_id: String(record.owner_id),
      type: "visit_requested",
      title: "Nueva visita programada",
      message: `${name} solicitó visitar "${String(record.name || "tu inmueble")}" el ${date}.`,
      link: "/owner/calendar",
    },
  ]);

  return NextResponse.json({ visit: created }, { status: 201 });
}
