import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestTransitionSchema } from "@/lib/validators/schemas";

const DOC_FILENAME_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$/i;
const DEFAULT_CONTRACT_TERMS =
  "Contrato de arriendo básico. El arrendatario se compromete a pagar la renta puntualmente y a cuidar el inmueble.";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["owner", "tenant", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = requestTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Acción inválida" }, { status: 400 });
  }

  const { data: reqRow } = await supabase
    .from("rental_requests")
    .select("*, property:properties(id, owner_id, rental_type, max_rental_days)")
    .eq("id", id)
    .single();

  if (!reqRow) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }

  const prop = reqRow.property as { id: string; owner_id: string; rental_type: string; max_rental_days: number | null } | null;
  if (!prop) {
    return NextResponse.json({ error: "Propiedad asociada no encontrada" }, { status: 404 });
  }

  const isOwner = prop.owner_id === user.id && (profile.role === "owner" || profile.role === "admin");
  const isTenant = reqRow.tenant_id === user.id;
  const input = parsed.data;

  if (
    input.action === "first_accept" ||
    input.action === "first_reject" ||
    input.action === "second_accept" ||
    input.action === "second_reject" ||
    input.action === "second_return"
  ) {
    if (!isOwner && profile.role !== "admin") {
      return NextResponse.json({ error: "Solo el propietario del inmueble puede realizar esta acción" }, { status: 403 });
    }
  } else {
    if (!isTenant && profile.role !== "admin") {
      return NextResponse.json({ error: "Solo el inquilino solicitante puede realizar esta acción" }, { status: 403 });
    }
  }

  if (input.action === "first_accept") {
    if (reqRow.status !== "pending") {
      return NextResponse.json({ error: "Solo se puede aprobar en 1er filtro una solicitud pendiente" }, { status: 400 });
    }
    const { error } = await supabase
      .from("rental_requests")
      .update({ status: "first_accepted", first_decision_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, status: "first_accepted" });
  }

  if (input.action === "first_reject") {
    if (reqRow.status !== "pending") {
      return NextResponse.json({ error: "Solo se puede rechazar en 1er filtro una solicitud pendiente" }, { status: 400 });
    }
    const { error } = await supabase
      .from("rental_requests")
      .update({ status: "rejected", rejection_reason: input.reason, first_decision_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (input.action === "second_return") {
    if (reqRow.status !== "docs_submitted" && reqRow.status !== "returned") {
      return NextResponse.json({ error: "Solo se pueden devolver solicitudes con documentos enviados" }, { status: 400 });
    }
    const { error } = await supabase
      .from("rental_requests")
      .update({ status: "returned", return_message: input.returnMessage })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, status: "returned" });
  }

  if (input.action === "second_reject") {
    if (reqRow.status !== "docs_submitted" && reqRow.status !== "returned") {
      return NextResponse.json({ error: "Estado inválido para rechazo en 2º filtro" }, { status: 400 });
    }
    const { error } = await supabase
      .from("rental_requests")
      .update({ status: "rejected", rejection_reason: input.reason })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  if (input.action === "second_accept") {
    if (reqRow.status !== "docs_submitted" && reqRow.status !== "returned") {
      return NextResponse.json({ error: "Una solicitud debe tener documentos en revisión para aceptarse" }, { status: 400 });
    }

    const { data: acceptedReq, error: acceptErr } = await supabase
      .from("rental_requests")
      .update({ status: "accepted" })
      .eq("id", id)
      .in("status", ["docs_submitted", "returned"])
      .select("id")
      .maybeSingle();

    if (acceptErr) {
      return NextResponse.json({ error: acceptErr.message }, { status: 400 });
    }
    if (!acceptedReq) {
      return NextResponse.json({ error: "La solicitud cambió de estado antes de aceptarse" }, { status: 409 });
    }

    const contractClient = profile.role === "admin" ? (createAdminClient() ?? supabase) : supabase;
    const { data: existingContract } = await contractClient
      .from("contracts")
      .select("id")
      .eq("request_id", id)
      .maybeSingle();

    let contractId = (existingContract as { id?: string } | null)?.id ?? null;

    if (!contractId) {
      const { data: createdContract, error: contractErr } = await contractClient
        .from("contracts")
        .insert({
          request_id: id,
          property_id: prop.id,
          tenant_id: reqRow.tenant_id,
          owner_id: prop.owner_id,
          terms: DEFAULT_CONTRACT_TERMS,
          status: "pending_signatures",
        })
        .select("id")
        .single();

      if (contractErr || !createdContract) {
        const rollbackClient = createAdminClient() ?? supabase;
        const { error: rbErr } = await rollbackClient
          .from("rental_requests")
          .update({ status: reqRow.status })
          .eq("id", id);
        if (rbErr) {
          console.error("[requests/transition] Error revirtiendo second_accept tras fallo en contrato:", rbErr.message);
        }
        return NextResponse.json(
          { error: contractErr?.message || "No se pudo crear el contrato para esta solicitud" },
          { status: 400 }
        );
      }
      contractId = createdContract.id;
    }

    return NextResponse.json({ ok: true, status: "accepted", contractId });
  }

  if (input.action === "submit_docs") {
    if (reqRow.status !== "first_accepted" && reqRow.status !== "returned") {
      return NextResponse.json({ error: "La solicitud no está habilitada para subir documentos" }, { status: 400 });
    }
    if (prop.rental_type === "vivienda" && input.durationUnit === "meses" && input.durationValue > 12) {
      return NextResponse.json({ error: "La duración máxima para vivienda es de 12 meses" }, { status: 400 });
    }
    if (prop.max_rental_days && input.durationUnit === "dias" && input.durationValue > prop.max_rental_days) {
      return NextResponse.json({ error: `No más de ${prop.max_rental_days} días` }, { status: 400 });
    }

    const canonicalPrefix = `${reqRow.id}/${user.id}`;
    const legacyPrefix = `${user.id}/${reqRow.id}`;
    const storageListClient = createAdminClient() ?? supabase;
    const validatedDocs: Array<{ docType: string; filePath: string }> = [];

    for (const doc of input.documents) {
      const p = doc.filePath;
      if (!p || p.includes("..") || p.includes("\\") || p.includes("%") || p.includes("\0") || p.startsWith("/")) {
        return NextResponse.json({ error: "Ruta de documento inválida" }, { status: 400 });
      }
      const segments = p.split("/");
      const folderPrefix = segments.length === 3 ? `${segments[0]}/${segments[1]}` : "";
      if (
        segments.length !== 3 ||
        (folderPrefix !== canonicalPrefix && folderPrefix !== legacyPrefix) ||
        !DOC_FILENAME_REGEX.test(segments[2])
      ) {
        return NextResponse.json({ error: "Ruta de documento no autorizada" }, { status: 403 });
      }
      const fileName = segments[2];
      const { data: listed, error: listErr } = await storageListClient.storage
        .from("request-documents")
        .list(folderPrefix, { search: fileName });

      if (listErr || !listed?.some((f: { name: string }) => f.name === fileName)) {
        return NextResponse.json({ error: "El documento indicado no existe en Storage" }, { status: 400 });
      }
      validatedDocs.push({ docType: doc.docType, filePath: p });
    }

    const { data: existingDocs } = await supabase
      .from("request_documents")
      .select("id, doc_type, status")
      .eq("request_id", reqRow.id);

    const existingList = (existingDocs as Array<{ id: string; doc_type: string; status: string }> | null) ?? [];

    for (const doc of validatedDocs) {
      const replaceable = existingList.find(
        (d) => d.doc_type === doc.docType && (d.status === "pendiente" || d.status === "rechazado")
      );
      if (replaceable) {
        const { error: repErr } = await supabase
          .from("request_documents")
          .update({ file_url: doc.filePath })
          .eq("id", replaceable.id);
        if (repErr) return NextResponse.json({ error: repErr.message }, { status: 400 });
      } else {
        const { error: docErr } = await supabase.from("request_documents").insert({
          request_id: reqRow.id,
          doc_type: doc.docType,
          file_url: doc.filePath,
          status: "pendiente",
        });
        if (docErr) return NextResponse.json({ error: docErr.message }, { status: 400 });
      }
    }

    const { error: updErr } = await supabase
      .from("rental_requests")
      .update({
        status: "docs_submitted",
        labor_profile: input.laborProfile,
        has_cosigner: input.hasCosigner,
        cosigner_requires_property: input.cosignerRequiresProperty,
        desired_duration_value: input.durationValue,
        desired_duration_unit: input.durationUnit,
      })
      .eq("id", id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, status: "docs_submitted" });
  }

  if (input.action === "cancel") {
    if (!["pending", "first_accepted", "docs_submitted", "returned"].includes(reqRow.status)) {
      return NextResponse.json({ error: "Esta solicitud ya no puede cancelarse" }, { status: 400 });
    }
    const { error } = await supabase
      .from("rental_requests")
      .update({
        status: "rejected",
        rejection_reason: input.reason || "Cancelada por el inquilino",
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
}
