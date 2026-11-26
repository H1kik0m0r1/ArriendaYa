import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportCreateSchema } from "@/modules/reports/schemas";

export async function GET() {
  const auth = await requireApiAuth(["owner", "tenant", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;

  if (profile.role === "admin") {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data as Array<Record<string, unknown>> | null) ?? [];
    const admin = createAdminClient();
    if (!admin || rows.length === 0) {
      return NextResponse.json({ reports: rows });
    }

    const reporterIds = Array.from(
      new Set(rows.map((r) => r.reporter_id).filter((id): id is string => typeof id === "string"))
    );
    const propIds = Array.from(
      new Set(
        rows
          .filter((r) => r.target_type === "property" && typeof r.target_id === "string")
          .map((r) => String(r.target_id))
      )
    );

    const [{ data: reporters }, { data: props }] = await Promise.all([
      reporterIds.length
        ? admin.from("profiles").select("id, full_name, email").in("id", reporterIds)
        : Promise.resolve({ data: [] }),
      propIds.length
        ? admin.from("properties").select("id, name").in("id", propIds)
        : Promise.resolve({ data: [] }),
    ]);

    const repMap = new Map(
      ((reporters as Array<{ id: string; full_name: string | null; email: string }> | null) ?? []).map(
        (p) => [p.id, p]
      )
    );
    const propMap = new Map(
      ((props as Array<{ id: string; name: string }> | null) ?? []).map((p) => [p.id, p.name])
    );

    const enriched = rows.map((r) => {
      const repId = typeof r.reporter_id === "string" ? r.reporter_id : null;
      const tgtId = typeof r.target_id === "string" ? r.target_id : null;
      const reporter = repId ? repMap.get(repId) : undefined;
      return {
        ...r,
        reporter_name: reporter?.full_name ?? null,
        reporter_email: reporter?.email ?? null,
        property_name: r.target_type === "property" && tgtId ? (propMap.get(tgtId) ?? null) : null,
      };
    });

    return NextResponse.json({ reports: enriched });
  }

  if (profile.role === "owner") {
    const admin = createAdminClient();
    if (!admin) {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("reporter_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ reports: data || [] });
    }

    const { data: ownProps } = await admin
      .from("properties")
      .select("id")
      .eq("owner_id", user.id);
    const propIds = ((ownProps as Array<{ id: string }> | null) ?? []).map((p) => p.id);

    const [{ data: ownReports }, { data: propReports }] = await Promise.all([
      admin.from("reports").select("*").eq("reporter_id", user.id),
      propIds.length > 0
        ? admin.from("reports").select("*").eq("target_type", "property").in("target_id", propIds)
        : Promise.resolve({ data: [] }),
    ]);

    const merged = new Map<string, Record<string, unknown>>();
    for (const r of [...(ownReports || []), ...(propReports || [])] as Array<Record<string, unknown>>) {
      if (typeof r.id === "string") merged.set(r.id, r);
    }
    const sorted = Array.from(merged.values()).sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
    );
    return NextResponse.json({ reports: sorted });
  }

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("reporter_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ reports: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner", "tenant", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = reportCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos de reporte inválidos" },
      { status: 400 }
    );
  }

  const propertyId = parsed.data.propertyId?.trim() || null;
  if (propertyId) {
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .maybeSingle();
    if (!prop) {
      return NextResponse.json({ error: "Propiedad reportada no encontrada" }, { status: 404 });
    }
  }

  const { data: created, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      target_id: propertyId,
      target_type: propertyId ? "property" : "plataforma",
      reason: parsed.data.reason,
      description: parsed.data.description,
      status: "pendiente",
    })
    .select("*")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message || "No se pudo registrar el reporte" }, { status: 400 });
  }

  return NextResponse.json({ report: created }, { status: 201 });
}
