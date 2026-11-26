import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/server-guard";
import {
  hasServerNotificationCapability,
  insertServerNotifications,
} from "@/lib/notifications/server-notify";

const MIN_PHOTOS_TO_PUBLISH = 4;

const patchStatusSchema = z.object({
  status: z.enum(["draft", "published", "rented", "paused", "maintenance", "archived"]),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = patchStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado de inmueble inválido" }, { status: 400 });
  }

  const { data: prop } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!prop) {
    return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }
  const propRecord = prop as Record<string, unknown>;
  if (propRecord.owner_id !== user.id && profile.role !== "admin") {
    return NextResponse.json({ error: "No autorizado para modificar esta propiedad" }, { status: 403 });
  }

  const moderationStatus =
    typeof propRecord.moderation_status === "string" ? propRecord.moderation_status : "active";
  if (parsed.data.status === "published" && moderationStatus !== "active") {
    return NextResponse.json(
      {
        error:
          "Este inmueble tiene una medida administrativa vigente y no puede publicarse hasta ser restaurado.",
      },
      { status: 409 }
    );
  }

  if (parsed.data.status === "published" && propRecord.status !== "published") {
    const { count } = await supabase
      .from("property_images")
      .select("id", { count: "exact", head: true })
      .eq("property_id", id);

    if ((count ?? 0) < MIN_PHOTOS_TO_PUBLISH) {
      return NextResponse.json(
        {
          error: `Se requieren al menos ${MIN_PHOTOS_TO_PUBLISH} fotografías para publicar este inmueble (actualmente tiene ${count ?? 0}).`,
        },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("properties")
    .update({ status: parsed.data.status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: parsed.data.status });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;
  const { id } = await ctx.params;

  const { data: prop } = await supabase
    .from("properties")
    .select("id, owner_id, name")
    .eq("id", id)
    .single();

  if (!prop) {
    return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }
  if (prop.owner_id !== user.id && profile.role !== "admin") {
    return NextResponse.json({ error: "No autorizado para eliminar esta propiedad" }, { status: 403 });
  }

  const { data: blockingContracts } = await supabase
    .from("contracts")
    .select("id")
    .eq("property_id", id)
    .in("status", ["pending_signatures", "active", "expiring", "renewed"])
    .limit(1);

  if (blockingContracts && blockingContracts.length > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar una propiedad con contratos vigentes o en firma." },
      { status: 409 }
    );
  }

  const { data: reqs } = await supabase
    .from("rental_requests")
    .select("tenant_id")
    .eq("property_id", id);

  const uniqueTenants = Array.from(
    new Set(((reqs as Array<{ tenant_id: string }> | null) ?? []).map((r) => r.tenant_id))
  );

  if (uniqueTenants.length > 0 && !hasServerNotificationCapability()) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para notificar a los solicitantes al retirar la propiedad." },
      { status: 503 }
    );
  }

  const { error: delErr } = await supabase.from("properties").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  if (uniqueTenants.length > 0) {
    const notifRes = await insertServerNotifications(
      uniqueTenants.map((tenantId) => ({
        user_id: tenantId,
        type: "property_removed",
        title: "Propiedad retirada",
        message: `La propiedad "${prop.name || "Inmueble"}" ya no se puede solicitar porque ha sido retirada.`,
        link: "/",
      }))
    );
    if (!notifRes.ok) {
      return NextResponse.json(
        { error: `Propiedad eliminada, pero falló el envío de notificaciones: ${notifRes.error}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
