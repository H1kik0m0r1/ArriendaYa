import { createClient } from "@/lib/supabase/client";
import type { Contract } from "@/modules/contracts/types";
import type { Notification } from "@/modules/notifications/types";
import type { Property } from "@/modules/properties/types";
import type { RentalRequest } from "@/modules/rental-requests/types";

export async function getOwnerRawAnalyticsRecords(ownerId: string): Promise<{
  properties: Array<Property & { visits?: number }>;
  requests: RentalRequest[];
  contracts: Contract[];
  notifications: Notification[];
  viewsByProperty: Record<string, number>;
  visitRequestsByProperty: Record<string, number>;
}> {
  const supabase = createClient();
  const { data: props } = await supabase.from("properties").select("*").eq("owner_id", ownerId);
  const properties = (props as Array<Property & { visits?: number }> | null) ?? [];
  const ids = properties.map((p) => p.id);

  const [{ data: reqs }, { data: cons }, { data: notifs }, { data: views }, { data: vis }] = await Promise.all([
    ids.length
      ? supabase.from("rental_requests").select("*").in("property_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("contracts").select("*").in("property_id", ids)
      : Promise.resolve({ data: [] }),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: false }),
    ids.length
      ? supabase.from("property_views").select("property_id").in("property_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("visits").select("property_id").in("property_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const viewsByProperty: Record<string, number> = {};
  for (const row of (views as Array<{ property_id: string | null }> | null) ?? []) {
    if (!row.property_id) continue;
    viewsByProperty[row.property_id] = (viewsByProperty[row.property_id] || 0) + 1;
  }

  const visitRequestsByProperty: Record<string, number> = {};
  for (const row of (vis as Array<{ property_id: string | null }> | null) ?? []) {
    if (!row.property_id) continue;
    visitRequestsByProperty[row.property_id] = (visitRequestsByProperty[row.property_id] || 0) + 1;
  }

  return {
    properties,
    requests: (reqs as RentalRequest[] | null) ?? [],
    contracts: (cons as Contract[] | null) ?? [],
    notifications: (notifs as Notification[] | null) ?? [],
    viewsByProperty,
    visitRequestsByProperty,
  };
}

export async function getTenantRawDashboardRecords(tenantId: string): Promise<{
  requests: RentalRequest[];
  contracts: Contract[];
  notifications: Notification[];
}> {
  const supabase = createClient();
  const [{ data: reqs }, { data: cons }, { data: notifs }] = await Promise.all([
    supabase.from("rental_requests").select("*").eq("tenant_id", tenantId),
    supabase.from("contracts").select("*").eq("tenant_id", tenantId),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    requests: (reqs as RentalRequest[] | null) ?? [],
    contracts: (cons as Contract[] | null) ?? [],
    notifications: (notifs as Notification[] | null) ?? [],
  };
}
