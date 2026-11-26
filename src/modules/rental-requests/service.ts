import { isDemoMode } from "@/lib/config/env";
import { PRIVATE_BUCKET_RULES } from "@/lib/storage/private-files";
import { createClient } from "@/lib/supabase/client";
import { validateFile } from "@/lib/utils";
import { apiJsonFetch, errResult, okResult, type ServiceResult } from "@/modules/shared/service-result";
import { uploadPrivateFile } from "@/modules/shared/upload-client";
import type { Property } from "@/modules/properties/types";
import type { RequestDocsFormValues } from "./schemas";
import type { RentalRequest } from "./types";

export async function createRentalRequest(propertyId: string, ownerId: string): Promise<ServiceResult<true>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errResult("UNAUTHENTICATED");
  if (user.id === ownerId) return errResult("No puedes solicitar tu propia propiedad.");

  if (isDemoMode()) {
    const { data: active } = await supabase
      .from("rental_requests")
      .select("id, status")
      .eq("property_id", propertyId)
      .eq("tenant_id", user.id)
      .in("status", ["pending", "first_accepted", "docs_submitted", "returned", "accepted"]);
    if (active && active.length > 0) {
      return errResult("Ya tienes una solicitud activa para esta propiedad.");
    }
    const { error } = await supabase.from("rental_requests").insert({
      property_id: propertyId,
      tenant_id: user.id,
      status: "pending",
    });
    if (error) return errResult(error.message);
    return okResult(true);
  }

  const res = await apiJsonFetch("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId }),
  });
  if (!res.ok) return res;
  return okResult(true);
}

export async function executeRequestTransition(
  requestId: string,
  payload: Record<string, unknown>,
  context?: { req: RentalRequest | null; property: Property | null }
): Promise<ServiceResult<true>> {
  if (isDemoMode()) {
    const supabase = createClient();
    const action = payload.action;
    if (action === "first_accept") {
      await supabase
        .from("rental_requests")
        .update({ status: "first_accepted", first_decision_at: new Date().toISOString() })
        .eq("id", requestId);
    } else if (action === "first_reject" || action === "second_reject") {
      await supabase
        .from("rental_requests")
        .update({ status: "rejected", rejection_reason: payload.reason })
        .eq("id", requestId);
    } else if (action === "second_return") {
      await supabase
        .from("rental_requests")
        .update({ status: "returned", return_message: payload.returnMessage })
        .eq("id", requestId);
    } else if (action === "second_accept" && context?.req && context.property) {
      await supabase.from("rental_requests").update({ status: "accepted" }).eq("id", requestId);
      await supabase.from("contracts").insert({
        request_id: requestId,
        property_id: context.property.id,
        tenant_id: context.req.tenant_id,
        owner_id: context.property.owner_id,
        status: "pending_signatures",
      });
    } else if (action === "cancel") {
      await supabase
        .from("rental_requests")
        .update({ status: "rejected", rejection_reason: payload.reason || "Cancelada por el inquilino" })
        .eq("id", requestId);
    }
    return okResult(true);
  }

  const res = await apiJsonFetch(`/api/requests/${requestId}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return res;
  return okResult(true);
}

export async function reviewRequestDocument(
  docId: string,
  status: "aprobado" | "rechazado"
): Promise<ServiceResult<true>> {
  if (isDemoMode()) {
    const supabase = createClient();
    const { error } = await supabase.from("request_documents").update({ status }).eq("id", docId);
    if (error) return errResult(error.message);
    return okResult(true);
  }

  const res = await apiJsonFetch(`/api/documents/${docId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) return res;
  return okResult(true);
}

export async function addRequestNote(requestId: string, text: string): Promise<ServiceResult<true>> {
  if (isDemoMode()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("request_notes").insert({
      request_id: requestId,
      author_id: user?.id ?? null,
      text: text.trim(),
      created_at: new Date().toISOString(),
    });
    if (error) return errResult(error.message);
    return okResult(true);
  }

  const res = await apiJsonFetch(`/api/requests/${requestId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.trim() }),
  });
  if (!res.ok) return res;
  return okResult(true);
}

export async function submitRequestDocuments(
  requestId: string,
  property: Property,
  meta: RequestDocsFormValues,
  files: Record<string, File>
): Promise<ServiceResult<true>> {
  const durationNumeric = Number(meta.durationValue);
  if (property.rental_type === "vivienda" && meta.durationUnit === "meses" && durationNumeric > 12) {
    return errResult("Máximo 12 meses.");
  }
  if (property.max_rental_days && meta.durationUnit === "dias" && durationNumeric > property.max_rental_days) {
    return errResult(`No más de ${property.max_rental_days} días.`);
  }

  const entries = Object.entries(files);
  if (entries.length === 0) {
    return errResult("Selecciona al menos un documento para enviar.");
  }

  const rules = PRIVATE_BUCKET_RULES["request-documents"];
  for (const [, file] of entries) {
    const v = validateFile(file, rules.maxSizeBytes / (1024 * 1024), rules.allowedMimeTypes);
    if (!v.valid) return errResult(v.error || "Archivo inválido");
  }

  if (isDemoMode()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errResult("No autenticado");

    const { data: existingDocs } = await supabase
      .from("request_documents")
      .select("id, doc_type, status")
      .eq("request_id", requestId);
    const existingList = (existingDocs as Array<{ id: string; doc_type: string; status: string }> | null) ?? [];

    for (const [docType, file] of entries) {
      const path = `${requestId}/${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("request-documents").upload(path, file);
      if (upErr) return errResult(upErr.message);
      const replaceable = existingList.find(
        (d) => d.doc_type === docType && (d.status === "pendiente" || d.status === "rechazado")
      );
      if (replaceable) {
        await supabase.from("request_documents").update({ file_url: path }).eq("id", replaceable.id);
      } else {
        await supabase
          .from("request_documents")
          .insert({ request_id: requestId, doc_type: docType, file_url: path, status: "pendiente" });
      }
    }
    const { error: updErr } = await supabase
      .from("rental_requests")
      .update({
        status: "docs_submitted",
        labor_profile: meta.laborProfile,
        has_cosigner: meta.hasCosigner,
        cosigner_requires_property: meta.cosignerRequiresProperty,
        desired_duration_value: durationNumeric,
        desired_duration_unit: meta.durationUnit,
      })
      .eq("id", requestId);
    if (updErr) return errResult(updErr.message);
    return okResult(true);
  }

  const uploadedDocs: Array<{ docType: string; filePath: string }> = [];
  for (const [docType, file] of entries) {
    const uploaded = await uploadPrivateFile("request-documents", requestId, file);
    if (!uploaded.ok) return uploaded;
    uploadedDocs.push({ docType, filePath: uploaded.data });
  }

  const res = await apiJsonFetch(`/api/requests/${requestId}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "submit_docs",
      laborProfile: meta.laborProfile,
      hasCosigner: meta.hasCosigner,
      cosignerRequiresProperty: meta.cosignerRequiresProperty,
      durationValue: durationNumeric,
      durationUnit: meta.durationUnit,
      documents: uploadedDocs,
    }),
  });
  if (!res.ok) return res;
  return okResult(true);
}
