import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConversationSchema } from "@/lib/validators/schemas";

export async function GET() {
  const auth = await requireApiAuth(["owner", "tenant", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const { data: rows, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`owner_id.eq.${user.id},tenant_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const list = (rows as Array<{
    id: string;
    owner_id: string;
    tenant_id: string | null;
    tenant_email: string | null;
    created_at: string;
  }> | null) ?? [];

  const partnerIds = Array.from(
    new Set(
      list
        .map((c) => (c.owner_id === user.id ? c.tenant_id : c.owner_id))
        .filter((id): id is string => Boolean(id))
    )
  );

  const partnerMap = new Map<string, { full_name: string | null; email: string | null }>();
  const admin = createAdminClient();
  if (partnerIds.length > 0 && admin) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", partnerIds);
    for (const p of (profiles as Array<{ id: string; full_name: string | null; email: string | null }> | null) ?? []) {
      partnerMap.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }

  const conversations = list.map((c) => {
    const partnerId = c.owner_id === user.id ? c.tenant_id : c.owner_id;
    const partner = partnerId ? partnerMap.get(partnerId) : undefined;
    return {
      ...c,
      partner_name: partner?.full_name ?? null,
      partner_email: partner?.email ?? (c.owner_id === user.id ? c.tenant_email : null),
    };
  });

  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Correo inválido" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para validar conversaciones." },
      { status: 503 }
    );
  }

  const normalizedEmail = parsed.data.tenantEmail.toLowerCase();
  const { data: targetProfile } = await admin
    .from("profiles")
    .select("id, email, role")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (!targetProfile || targetProfile.id === user.id) {
    return NextResponse.json(
      { error: "No existe una relación activa con ese usuario para iniciar conversación." },
      { status: 403 }
    );
  }

  const [{ data: ownerProps }, { data: relContract }] = await Promise.all([
    admin.from("properties").select("id").eq("owner_id", user.id),
    admin
      .from("contracts")
      .select("id")
      .eq("owner_id", user.id)
      .eq("tenant_id", targetProfile.id)
      .limit(1)
      .maybeSingle(),
  ]);

  let hasRelation = Boolean(relContract);

  if (!hasRelation) {
    const propIds = ((ownerProps as Array<{ id: string }> | null) ?? []).map((p) => p.id);
    if (propIds.length > 0) {
      const [{ data: relReq }, { data: relVisit }, { data: relRes }] = await Promise.all([
        admin
          .from("rental_requests")
          .select("id")
          .eq("tenant_id", targetProfile.id)
          .in("property_id", propIds)
          .limit(1)
          .maybeSingle(),
        admin
          .from("visits")
          .select("id")
          .eq("tenant_id", targetProfile.id)
          .in("property_id", propIds)
          .limit(1)
          .maybeSingle(),
        admin
          .from("reservations")
          .select("id")
          .eq("tenant_id", targetProfile.id)
          .in("property_id", propIds)
          .limit(1)
          .maybeSingle(),
      ]);
      hasRelation = Boolean(relReq || relVisit || relRes);
    }
  }

  if (!hasRelation) {
    return NextResponse.json(
      { error: "Solo puedes conversar con usuarios que tengan solicitud, visita, reserva o contrato contigo." },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("owner_id", user.id)
    .eq("tenant_id", targetProfile.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ conversation: existing, existing: true });
  }

  const { data: created, error: insErr } = await supabase
    .from("conversations")
    .insert({
      owner_id: user.id,
      tenant_id: targetProfile.id,
      tenant_email: targetProfile.email,
    })
    .select("*")
    .single();

  if (insErr || !created) {
    return NextResponse.json(
      { error: insErr?.message || "No se pudo crear la conversación" },
      { status: 400 }
    );
  }

  return NextResponse.json({ conversation: created }, { status: 201 });
}
