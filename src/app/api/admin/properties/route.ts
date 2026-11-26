import { NextResponse } from "next/server";
import { requireAdminService } from "@/lib/admin/server-helpers";
import type { AdminPropertyItem } from "@/modules/admin/types";
import type { PropertyModerationStatus, PropertyStatus } from "@/modules/properties/types";

export async function GET(request: Request) {
  const guard = await requireAdminService();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const statusFilter = (searchParams.get("status") || "").trim();
  const moderationFilter = (searchParams.get("moderation") || "").trim();

  const [
    { data: rawProps, error: propErr },
    { data: rawImages },
    { data: rawProfiles },
    { data: rawRequests },
    { data: rawContracts },
  ] = await Promise.all([
    admin.from("properties").select("*").order("created_at", { ascending: false }),
    admin.from("property_images").select("property_id, url, sort_order"),
    admin.from("profiles").select("id, full_name, email"),
    admin.from("rental_requests").select("id, property_id"),
    admin.from("contracts").select("id, property_id, status"),
  ]);

  if (propErr) {
    return NextResponse.json({ error: propErr.message }, { status: 400 });
  }

  const propRows = (rawProps as Array<Record<string, unknown>> | null) ?? [];
  const migrationReady = propRows.length === 0 || "moderation_status" in propRows[0];

  const ownerMap = new Map(
    ((rawProfiles as Array<{ id: string; full_name: string | null; email: string }> | null) ?? []).map(
      (p) => [p.id, p]
    )
  );

  const imgStats = new Map<string, { count: number; firstUrl: string | null; firstOrder: number }>();
  for (const img of (rawImages as Array<{ property_id: string; url: string; sort_order: number }> | null) ?? []) {
    if (!img.property_id) continue;
    const prev = imgStats.get(img.property_id);
    const order = Number(img.sort_order ?? 0);
    if (!prev) {
      imgStats.set(img.property_id, { count: 1, firstUrl: img.url, firstOrder: order });
    } else {
      imgStats.set(img.property_id, {
        count: prev.count + 1,
        firstUrl: order < prev.firstOrder ? img.url : prev.firstUrl,
        firstOrder: Math.min(prev.firstOrder, order),
      });
    }
  }

  const reqCounts = new Map<string, number>();
  for (const r of (rawRequests as Array<{ id: string; property_id: string }> | null) ?? []) {
    reqCounts.set(r.property_id, (reqCounts.get(r.property_id) || 0) + 1);
  }

  const contractCounts = new Map<string, { total: number; active: number }>();
  for (const c of (rawContracts as Array<{ id: string; property_id: string; status: string }> | null) ?? []) {
    const prev = contractCounts.get(c.property_id) || { total: 0, active: 0 };
    const isActive = ["pending_signatures", "active", "expiring"].includes(c.status);
    contractCounts.set(c.property_id, {
      total: prev.total + 1,
      active: prev.active + (isActive ? 1 : 0),
    });
  }

  let items: AdminPropertyItem[] = propRows.map((p) => {
    const id = String(p.id);
    const ownerId = String(p.owner_id);
    const owner = ownerMap.get(ownerId);
    const imgs = imgStats.get(id);
    const cons = contractCounts.get(id);
    const modRaw = typeof p.moderation_status === "string" ? p.moderation_status : "active";
    const moderation_status: PropertyModerationStatus =
      modRaw === "paused_by_admin" || modRaw === "suspended" ? modRaw : "active";

    return {
      id,
      owner_id: ownerId,
      owner_name: owner?.full_name ?? null,
      owner_email: owner?.email ?? null,
      name: String(p.name || "Inmueble"),
      type: String(p.type || ""),
      location: String(p.location || ""),
      price: Number(p.price || 0),
      price_period: String(p.price_period || "mes"),
      status: p.status as PropertyStatus,
      moderation_status,
      moderation_reason: typeof p.moderation_reason === "string" ? p.moderation_reason : null,
      moderated_at: typeof p.moderated_at === "string" ? p.moderated_at : null,
      moderated_by: typeof p.moderated_by === "string" ? p.moderated_by : null,
      created_at: String(p.created_at || new Date().toISOString()),
      updated_at: String(p.updated_at || p.created_at || new Date().toISOString()),
      image_url: imgs?.firstUrl ?? null,
      images_count: imgs?.count ?? 0,
      requests_count: reqCounts.get(id) ?? 0,
      contracts_count: cons?.total ?? 0,
      active_contracts_count: cons?.active ?? 0,
    };
  });

  if (statusFilter) {
    items = items.filter((item) => item.status === statusFilter);
  }
  if (moderationFilter) {
    items = items.filter((item) => item.moderation_status === moderationFilter);
  }
  if (q) {
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (item.owner_name || "").toLowerCase().includes(q) ||
        (item.owner_email || "").toLowerCase().includes(q)
    );
  }

  return NextResponse.json({ migrationReady, properties: items });
}
