import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { insertServerNotifications } from "@/lib/notifications/server-notify";

const notifySchema = z.object({
  event: z.enum(["updated", "removed"]),
  propertyName: z.string().trim().min(1).max(200),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { data: prop } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", id)
    .single();

  if (!prop || (prop.owner_id !== user.id && profile.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: reqs } = await supabase
    .from("rental_requests")
    .select("tenant_id")
    .eq("property_id", id);

  if (reqs && reqs.length > 0) {
    const typedReqs = reqs as Array<{ tenant_id: string }>;
    const uniqueTenants = Array.from(new Set(typedReqs.map((r) => r.tenant_id)));
    const isRemoved = parsed.data.event === "removed";
    const notifRes = await insertServerNotifications(
      uniqueTenants.map((tenantId) => ({
        user_id: tenantId,
        type: isRemoved ? "property_removed" : "property_updated",
        title: isRemoved ? "Propiedad retirada" : "Propiedad actualizada",
        message: isRemoved
          ? `La propiedad "${parsed.data.propertyName}" ya no se puede solicitar porque ha sido retirada.`
          : `La información de "${parsed.data.propertyName}" ha sido actualizada.`,
        link: isRemoved ? "/" : `/properties/${id}`,
      }))
    );
    if (!notifRes.ok) {
      return NextResponse.json(
        { error: notifRes.error },
        { status: notifRes.code === "MISSING_SERVICE_KEY" ? 503 : 502 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
