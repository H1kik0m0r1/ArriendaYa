import { isDemoMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";
import { validateFile } from "@/lib/utils";
import { apiJsonFetch, errResult, okResult, type ServiceResult } from "@/modules/shared/service-result";
import {
  addPropertyToSavedListRecord,
  deletePropertyById,
  deletePropertyImageRecord,
  insertProperty,
  insertPropertyImageRecord,
  insertSavedList,
  listOwnerProperties,
  listSavedListItems,
  listSavedListsByUser,
  listSavedPropertiesWithImages,
  removePropertyFromSavedListRecord,
  updatePropertyById,
  updatePropertyStatusById,
} from "./repository";
import type { PropertyEditValues, PropertyWizardValues } from "./schemas";
import type { Property, PropertyImage, PropertyStatus, SavedPropertyList } from "./types";

export const MIN_PROPERTY_PHOTOS = 4;

export async function publishPropertyFromWizard(
  values: PropertyWizardValues,
  coords: { latitude: number | null; longitude: number | null },
  photoFiles: File[],
  onProgress?: (uploaded: number, total: number) => void
): Promise<ServiceResult<Property>> {
  if (photoFiles.length < MIN_PROPERTY_PHOTOS) {
    return errResult(`Debes adjuntar al menos ${MIN_PROPERTY_PHOTOS} fotografías para publicar tu inmueble.`);
  }
  for (const file of photoFiles) {
    const check = validateFile(file, 8, ["image/jpeg", "image/png", "image/webp"]);
    if (!check.valid) {
      return errResult(`${file.name}: ${check.error || "Imagen inválida"}`);
    }
  }

  let createdProp: Property | null = null;

  if (isDemoMode()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errResult("No autenticado");

    const { data, error } = await insertProperty({
      owner_id: user.id,
      name: values.name,
      type: values.type,
      max_people: Number(values.max_people),
      area_sqm: Number(values.area_sqm),
      location: values.location,
      description: values.description || null,
      rental_type: values.rental_type,
      price: Number(values.price),
      price_period: values.price_period,
      address: values.address || null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      contact_phone: values.contact_phone || null,
      status: "draft",
    });
    if (error || !data) {
      return errResult(error?.message || "No se pudo crear el inmueble");
    }
    createdProp = data as Property;
  } else {
    const draftRes = await apiJsonFetch<{ property?: Property }>("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        type: values.type,
        max_people: Number(values.max_people),
        area_sqm: Number(values.area_sqm),
        location: values.location,
        description: values.description || null,
        rental_type: values.rental_type,
        price: Number(values.price),
        price_period: values.price_period,
        address: values.address || null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        contact_phone: values.contact_phone || null,
      }),
    });
    if (!draftRes.ok || !draftRes.data.property) {
      return errResult(draftRes.ok ? "No se recibió el inmueble creado" : draftRes.error);
    }
    createdProp = draftRes.data.property;
  }

  let uploadedCount = 0;
  for (let i = 0; i < photoFiles.length; i++) {
    const upRes = await uploadOwnerPropertyImage(createdProp.id, photoFiles[i], i);
    if (!upRes.ok) {
      return errResult(
        `El inmueble se guardó como borrador, pero falló la carga de "${photoFiles[i].name}": ${upRes.error}. Completa las fotos desde Mis propiedades -> Editar.`
      );
    }
    uploadedCount += 1;
    onProgress?.(uploadedCount, photoFiles.length);
  }

  const pubRes = await changeOwnerPropertyStatus(createdProp.id, "published");
  if (!pubRes.ok) {
    return errResult(
      `El inmueble se guardó como borrador con las fotografías, pero no se pudo publicar: ${pubRes.error}`
    );
  }

  return okResult({ ...createdProp, status: "published" });
}

export async function savePropertyUpdates(
  id: string,
  values: PropertyEditValues,
  coords: { latitude: number | null; longitude: number | null }
): Promise<ServiceResult<true>> {
  const toNullableNum = (raw?: string) => (raw && raw.trim() ? Number(raw) : null);

  const { error } = await updatePropertyById(id, {
    name: values.name,
    type: values.type,
    max_people: Number(values.max_people),
    area_sqm: Number(values.area_sqm),
    location: values.location,
    address: values.address || null,
    latitude: coords.latitude,
    longitude: coords.longitude,
    includes_administration: values.includes_administration,
    administration_fee: toNullableNum(values.administration_fee),
    parking: toNullableNum(values.parking),
    floor_area: toNullableNum(values.floor_area),
    condition: values.condition,
    stratum: toNullableNum(values.stratum),
    nearby_centers: values.nearby_centers || null,
    available_from: values.available_from || null,
    requires_cosigner: values.requires_cosigner,
    deposit_months: toNullableNum(values.deposit_months),
    renter_type: values.renter_type,
    renter_name: values.renter_name || null,
    furnished: values.furnished,
    pets_allowed: values.pets_allowed,
    for_new: values.for_new,
    video_url: values.video_url || null,
    whatsapp_contact: values.whatsapp_contact || null,
    description: values.description || null,
    rental_type: values.rental_type,
    max_rental_days: values.has_max_days ? toNullableNum(values.max_rental_days) : null,
    price: Number(values.price),
    price_period: values.price_period,
    contact_phone: values.contact_phone || null,
    contact_email: values.contact_email || null,
    contact_social: values.contact_social || null,
    discount_percent: values.discount_percent ? Number(values.discount_percent) : 0,
    discount_until: values.discount_until ? new Date(values.discount_until).toISOString() : null,
  });

  if (error) return errResult(error.message);

  if (!isDemoMode()) {
    const notifyRes = await apiJsonFetch(`/api/properties/${id}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "updated", propertyName: values.name }),
    });
    if (!notifyRes.ok) {
      return errResult(notifyRes.error || "Propiedad guardada, pero falló el envío de notificaciones.");
    }
  }

  return okResult(true);
}

export async function removeProperty(id: string): Promise<ServiceResult<true>> {
  if (isDemoMode()) {
    const { error } = await deletePropertyById(id);
    if (error) return errResult(error.message);
    return okResult(true);
  }
  const res = await apiJsonFetch(`/api/properties/${id}`, { method: "DELETE" });
  if (!res.ok) return res;
  return okResult(true);
}

export async function duplicateOwnerProperty(property: Property): Promise<ServiceResult<Property[]>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errResult("No autenticado");

  const copy: Record<string, unknown> = { ...property, name: `${property.name} (copia)`, status: "draft" };
  delete copy.id;
  delete copy.property_images;
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.moderation_status;
  delete copy.moderation_reason;
  delete copy.moderated_at;
  delete copy.moderated_by;

  const { error } = await insertProperty(copy);
  if (error) return errResult(error.message);
  return okResult(await listOwnerProperties(user.id));
}

export async function changeOwnerPropertyStatus(
  id: string,
  status: PropertyStatus
): Promise<ServiceResult<PropertyStatus>> {
  if (isDemoMode()) {
    const { error } = await updatePropertyStatusById(id, status);
    if (error) return errResult(error.message);
    return okResult(status);
  }
  const res = await apiJsonFetch<{ ok?: boolean; status?: PropertyStatus }>(`/api/properties/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) return res;
  return okResult(status);
}

const LEGACY_SAVED_LISTS_KEY = "arriendaya_saved_lists";

export async function loadTenantSavedData(): Promise<{
  properties: Property[];
  lists: SavedPropertyList[];
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { properties: [], lists: [] };

  const [properties, dbLists] = await Promise.all([
    listSavedPropertiesWithImages(user.id),
    listSavedListsByUser(user.id),
  ]);

  const itemRows = await listSavedListItems(dbLists.map((l) => l.id));
  const itemsByList = new Map<string, string[]>();
  for (const row of itemRows) {
    const arr = itemsByList.get(row.list_id) || [];
    arr.push(row.property_id);
    itemsByList.set(row.list_id, arr);
  }

  let legacyLists: SavedPropertyList[] = [];
  if (isDemoMode() && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LEGACY_SAVED_LISTS_KEY);
      const parsed = raw ? (JSON.parse(raw) as SavedPropertyList[]) : [];
      legacyLists = parsed.filter((l) => l.user_id === user.id && !dbLists.some((d) => d.id === l.id));
    } catch {}
  }

  const enrichedDbLists: SavedPropertyList[] = dbLists.map((l) => ({
    ...l,
    property_ids: itemsByList.get(l.id) || [],
  }));

  return { properties, lists: [...enrichedDbLists, ...legacyLists] };
}

export async function togglePropertyInSavedList(
  listId: string,
  propertyId: string,
  included: boolean
): Promise<ServiceResult<boolean>> {
  const res = included
    ? await removePropertyFromSavedListRecord(listId, propertyId)
    : await addPropertyToSavedListRecord(listId, propertyId);
  if (res.error) return errResult(res.error.message);
  return okResult(!included);
}

export async function uploadOwnerPropertyImage(
  propertyId: string,
  file: File,
  sortOrder = 0
): Promise<ServiceResult<PropertyImage>> {
  const validation = validateFile(file, 8, ["image/jpeg", "image/png", "image/webp"]);
  if (!validation.valid) {
    return errResult(validation.error || "Imagen inválida");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errResult("No autenticado");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("property-images").upload(path, file);
  if (upErr) return errResult(upErr.message);

  const { data: pubData } = supabase.storage.from("property-images").getPublicUrl(path);
  const publicUrl = pubData.publicUrl;
  const { data: row, error: insErr } = await insertPropertyImageRecord(propertyId, publicUrl, sortOrder);
  if (insErr || !row) {
    return errResult(insErr?.message || "No se pudo asociar la imagen");
  }
  return okResult(row as PropertyImage);
}

export async function removeOwnerPropertyImage(imageId: string): Promise<ServiceResult<true>> {
  const { error } = await deletePropertyImageRecord(imageId);
  if (error) return errResult(error.message);
  return okResult(true);
}

export async function createTenantSavedList(name: string): Promise<ServiceResult<SavedPropertyList>> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return errResult("El nombre debe tener al menos 2 caracteres");
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errResult("No autenticado");

  const { data, error } = await insertSavedList(user.id, trimmed);
  if (error || !data) {
    return errResult(error?.message || "No se pudo crear la lista");
  }
  return okResult(data as SavedPropertyList);
}
