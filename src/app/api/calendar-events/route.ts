import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { calendarEventSchema } from "@/modules/visits/schemas";

const calendarCreatePayloadSchema = calendarEventSchema.extend({
  type: z.enum(["maintenance", "personal"]),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner", "tenant", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = calendarCreatePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos del evento inválidos" },
      { status: 400 }
    );
  }

  const startIso = `${parsed.data.start}T00:00:00-05:00`;
  const endIso = `${parsed.data.end}T23:59:59-05:00`;

  const { data: created, error } = await supabase
    .from("calendar_events")
    .insert({
      user_id: user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      start: startIso,
      end: endIso,
    })
    .select("*")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message || "No se pudo guardar el evento" }, { status: 400 });
  }

  return NextResponse.json({ event: created }, { status: 201 });
}
