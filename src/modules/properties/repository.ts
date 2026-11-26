import { isDemoMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";
import type {
  Property,
  PropertyCoordinateItem,
  PropertyFilters,
  PropertyImage,
  PropertyStatus,
  SavedPropertyList,
} from "./types";

async function attachBatchImages(properties: Property[]): Promise<Property[]> {
  if (properties.length === 0) return properties;
  const ids = properties.map((p) => p.id);
  const supabase = createClient();
  const { data: imgs } = await supabase
    .from("property_images")
    .select("*")
    .in("property_id", ids);

  const byProperty = new Map<string, PropertyImage[]>();
  for (const img of (imgs as PropertyImage[] | null) ?? []) {
    if (!img.property_id) continue;
    const list = byProperty.get(img.property_id) || [];
    list.push(img);
    byProperty.set(img.property_id, list);
  }

  return properties.map((p) => ({
    ...p,
    property_images:
      p.property_images && p.property_images.length > 0
        ? p.property_images
        : (byProperty.get(p.id) || []).sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
  }));
}

export async function listPublishedProperties(
  filters?: PropertyFilters
): Promise<{ data: Property[]; total: number }> {
  const supabase = createClient();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 9;
  const sort = filters?.sort ?? "recent";
  const useServerPaging = !isDemoMode() && !filters?.skipPagination;

  let query = supabase
    .from("properties")
    .select("*", useServerPaging ? { count: "exact" } : undefined)
    .eq("status", "published");

  if (filters?.q) query = query.or(`name.ilike.%${filters.q}%,location.ilike.%${filters.q}%`);
  if (filters?.type) query = query.eq("type", filters.type);
  if (filters?.rentalType) query = query.eq("rental_type", filters.rentalType);
  if (filters?.petsAllowed) query = query.eq("pets_allowed", true);
  if (filters?.furnished) query = query.eq("furnished", filters.furnished);
  if (filters?.priceMin) query = query.gte("price", Number(filters.priceMin));
  if (filters?.priceMax) query = query.lte("price", Number(filters.priceMax));

  if (sort === "price_asc") {
    query = query.order("price", { ascending: true });
  } else if (sort === "price_desc") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  if (useServerPaging) {
    query = query.range(from, from + pageSize - 1);
  }

  const { data: matched, count } = await query;
  const rows = ((matched as Property[] | null) ?? []).filter(
    (p) => !p.moderation_status || p.moderation_status === "active"
  );
  const total = useServerPaging && typeof count === "number" ? count : rows.length;
  const sliced = useServerPaging || filters?.skipPagination ? rows : rows.slice(from, from + pageSize);

  return {
    data: await attachBatchImages(sliced),
    total,
  };
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const supabase = createClient();
  const { data } = await supabase.from("properties").select("*").eq("id", id).single();
  if (!data) return null;
  const [withImages] = await attachBatchImages([data as Property]);
  return withImages;
}

export async function listOwnerProperties(ownerId: string): Promise<Property[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return attachBatchImages((data as Property[] | null) ?? []);
}

export async function insertProperty(payload: Record<string, unknown>) {
  const supabase = createClient();
  return supabase.from("properties").insert(payload).select("*").single();
}

export async function updatePropertyById(id: string, payload: Record<string, unknown>) {
  const supabase = createClient();
  return supabase.from("properties").update(payload).eq("id", id);
}

export async function updatePropertyStatusById(id: string, status: PropertyStatus) {
  const supabase = createClient();
  return supabase.from("properties").update({ status }).eq("id", id);
}

export async function deletePropertyById(id: string) {
  const supabase = createClient();
  return supabase.from("properties").delete().eq("id", id);
}

export async function listUserSavedPropertyIds(): Promise<Set<string>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set<string>();
  const { data } = await supabase
    .from("saved_properties")
    .select("property_id")
    .eq("user_id", user.id);
  return new Set<string>(
    ((data as Array<{ property_id: string }> | null) ?? []).map((s) => s.property_id)
  );
}

export async function toggleSavedPropertyRecord(propertyId: string, nextSaved: boolean): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("no-auth");

  if (nextSaved) {
    const { error } = await supabase
      .from("saved_properties")
      .insert({ user_id: user.id, property_id: propertyId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("saved_properties")
      .delete()
      .eq("user_id", user.id)
      .eq("property_id", propertyId);
    if (error) throw new Error(error.message);
  }
  return nextSaved;
}

export async function listSavedPropertiesWithImages(userId: string): Promise<Property[]> {
  const supabase = createClient();
  const { data: saved } = await supabase
    .from("saved_properties")
    .select("property_id")
    .eq("user_id", userId);

  const ids = ((saved as Array<{ property_id: string }> | null) ?? []).map((s) => s.property_id);
  if (ids.length === 0) return [];

  const { data: props } = await supabase.from("properties").select("*").in("id", ids);
  return attachBatchImages((props as Property[] | null) ?? []);
}

export async function listSavedListsByUser(userId: string): Promise<SavedPropertyList[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("saved_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as SavedPropertyList[] | null) ?? [];
}

export async function insertSavedList(userId: string, name: string) {
  const supabase = createClient();
  return supabase.from("saved_lists").insert({ user_id: userId, name }).select("*").single();
}

export async function listPublishedPropertyCoordinates(): Promise<PropertyCoordinateItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("properties")
    .select("id, name, latitude, longitude")
    .eq("status", "published");
  return (data as PropertyCoordinateItem[] | null) ?? [];
}

export async function listSavedListItems(
  listIds: string[]
): Promise<Array<{ list_id: string; property_id: string }>> {
  if (listIds.length === 0) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("saved_list_items")
    .select("list_id, property_id")
    .in("list_id", listIds);
  return (data as Array<{ list_id: string; property_id: string }> | null) ?? [];
}

export async function addPropertyToSavedListRecord(listId: string, propertyId: string) {
  const supabase = createClient();
  return supabase.from("saved_list_items").insert({ list_id: listId, property_id: propertyId });
}

export async function removePropertyFromSavedListRecord(listId: string, propertyId: string) {
  const supabase = createClient();
  return supabase
    .from("saved_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("property_id", propertyId);
}

export async function recordAuthenticatedPropertyView(propertyId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("property_views").insert({
    property_id: propertyId,
    viewer_id: user.id,
  });
}

export async function insertPropertyImageRecord(propertyId: string, url: string, sortOrder = 0) {
  const supabase = createClient();
  return supabase
    .from("property_images")
    .insert({ property_id: propertyId, url, sort_order: sortOrder })
    .select("*")
    .single();
}

export async function deletePropertyImageRecord(imageId: string) {
  const supabase = createClient();
  return supabase.from("property_images").delete().eq("id", imageId);
}
