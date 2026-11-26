import { createClient } from "@/lib/supabase/client";
import type { Contract } from "@/modules/contracts/types";
import type { CalendarEventRecord, VisitRecord, VisitStatus } from "./types";

export async function insertPropertyVisit(payload: {
  property_id: string;
  tenant_id: string;
  name: string;
  phone: string;
  date: string;
}) {
  const supabase = createClient();
  return supabase.from("visits").insert({
    ...payload,
    papers: null,
    status: "solicitada",
  });
}

export async function listOwnerCalendarRecords(ownerId: string): Promise<{
  properties: Array<{ id: string; name: string }>;
  contracts: Contract[];
  visits: VisitRecord[];
  customEvents: CalendarEventRecord[];
}> {
  const supabase = createClient();
  const { data: props, error: propsError } = await supabase
    .from("properties")
    .select("id, name")
    .eq("owner_id", ownerId);
  if (propsError) throw new Error(propsError.message);

  const properties = (props as Array<{ id: string; name: string }> | null) ?? [];
  const ids = properties.map((p) => p.id);

  const [
    { data: cons, error: consError },
    { data: vis, error: visError },
    { data: cal, error: calError },
  ] = await Promise.all([
    ids.length
      ? supabase.from("contracts").select("*").in("property_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from("visits").select("*").in("property_id", ids).order("date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("calendar_events").select("*").eq("user_id", ownerId),
  ]);
  if (consError || visError || calError) {
    throw new Error(consError?.message || visError?.message || calError?.message || "Calendar query failed");
  }

  return {
    properties,
    contracts: (cons as Contract[] | null) ?? [],
    visits: (vis as VisitRecord[] | null) ?? [],
    customEvents: (cal as CalendarEventRecord[] | null) ?? [],
  };
}

export async function listTenantCalendarRecords(tenantId: string): Promise<{
  contracts: Contract[];
  visits: VisitRecord[];
  customEvents: CalendarEventRecord[];
}> {
  const supabase = createClient();
  const [
    { data: cons, error: consError },
    { data: vis, error: visError },
    { data: cal, error: calError },
  ] = await Promise.all([
    supabase.from("contracts").select("*").eq("tenant_id", tenantId),
    supabase.from("visits").select("*").eq("tenant_id", tenantId).order("date", { ascending: true }),
    supabase.from("calendar_events").select("*").eq("user_id", tenantId),
  ]);
  if (consError || visError || calError) {
    throw new Error(consError?.message || visError?.message || calError?.message || "Calendar query failed");
  }

  return {
    contracts: (cons as Contract[] | null) ?? [],
    visits: (vis as VisitRecord[] | null) ?? [],
    customEvents: (cal as CalendarEventRecord[] | null) ?? [],
  };
}

export async function insertCalendarEventRecord(payload: {
  user_id: string;
  type: string;
  title: string;
  start: string;
  end: string;
}) {
  const supabase = createClient();
  return supabase.from("calendar_events").insert(payload);
}

export async function updateVisitStatusRecord(visitId: string, status: VisitStatus) {
  const supabase = createClient();
  return supabase.from("visits").update({ status }).eq("id", visitId).select("*").single();
}
