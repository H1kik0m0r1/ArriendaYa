import { createClient } from "@/lib/supabase/client";
import type { Property } from "@/modules/properties/types";
import type { RentalRequest, RequestDocument, RequestNote } from "./types";

export async function listOwnerRequests(ownerId: string, statusFilter?: string): Promise<RentalRequest[]> {
  const supabase = createClient();
  const { data: props } = await supabase.from("properties").select("id").eq("owner_id", ownerId);
  const ids = ((props as Array<{ id: string }> | null) ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  let query = supabase
    .from("rental_requests")
    .select("*, property:properties(*)")
    .in("property_id", ids)
    .order("created_at", { ascending: false });
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data } = await query;
  return (data as RentalRequest[] | null) ?? [];
}

export async function listTenantRequests(tenantId: string, statusFilter?: string): Promise<RentalRequest[]> {
  const supabase = createClient();
  let query = supabase
    .from("rental_requests")
    .select("*, property:properties(*)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data } = await query;
  return (data as RentalRequest[] | null) ?? [];
}

export async function getRequestBundle(requestId: string): Promise<{
  request: RentalRequest | null;
  property: Property | null;
  documents: RequestDocument[];
  notes: RequestNote[];
}> {
  const supabase = createClient();
  const { data: reqData } = await supabase
    .from("rental_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  const request = (reqData as RentalRequest | null) ?? null;

  if (!request) {
    return { request: null, property: null, documents: [], notes: [] };
  }

  const [{ data: propData }, { data: docData }, { data: noteData }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", request.property_id).single(),
    supabase.from("request_documents").select("*").eq("request_id", requestId),
    supabase.from("request_notes").select("*").eq("request_id", requestId),
  ]);

  return {
    request,
    property: (propData as Property | null) ?? null,
    documents: (docData as RequestDocument[] | null) ?? [],
    notes: (noteData as RequestNote[] | null) ?? [],
  };
}

export async function listRequestDocumentsByRequestId(requestId: string): Promise<RequestDocument[]> {
  const supabase = createClient();
  const { data } = await supabase.from("request_documents").select("*").eq("request_id", requestId);
  return (data as RequestDocument[] | null) ?? [];
}

export async function listOwnerRequestsSummary(ownerId: string): Promise<Array<{ id: string; status: string }>> {
  const supabase = createClient();
  const { data: props } = await supabase.from("properties").select("id").eq("owner_id", ownerId);
  const ids = ((props as Array<{ id: string }> | null) ?? []).map((p) => p.id);
  if (ids.length === 0) return [];
  const { data: reqs } = await supabase.from("rental_requests").select("id, status").in("property_id", ids);
  return (reqs as Array<{ id: string; status: string }> | null) ?? [];
}

export async function findContractIdForRequest(requestId: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.from("contracts").select("id").eq("request_id", requestId).single();
  return (data as { id?: string } | null)?.id ?? null;
}
