import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PRIVATE_BUCKET_RULES,
  hasValidMagicBytes,
  mimeToSafeExtension,
  type PrivateBucket,
} from "@/lib/storage/private-files";

const ALLOWED_BUCKETS: PrivateBucket[] = [
  "request-documents",
  "payment-receipts",
  "identity-documents",
];

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;

  const formData = await request.formData();
  const bucketRaw = String(formData.get("bucket") || "");
  const entityId = String(formData.get("entityId") || "");
  const file = formData.get("file");

  if (!ALLOWED_BUCKETS.includes(bucketRaw as PrivateBucket)) {
    return NextResponse.json({ error: "Bucket inválido" }, { status: 400 });
  }
  const bucket = bucketRaw as PrivateBucket;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const rules = PRIVATE_BUCKET_RULES[bucket];
  if (file.size <= 0 || file.size > rules.maxSizeBytes) {
    return NextResponse.json(
      { error: `El archivo debe pesar entre 1 byte y ${Math.round(rules.maxSizeBytes / (1024 * 1024))}MB` },
      { status: 400 }
    );
  }
  if (!rules.allowedMimeTypes.includes(file.type)) {
    return NextResponse.json(
      { error: `Formato no permitido. Permitidos: ${rules.allowedMimeTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidMagicBytes(bytes, file.type)) {
    return NextResponse.json(
      { error: "El contenido del archivo no corresponde al tipo declarado" },
      { status: 400 }
    );
  }

  // Verificar permisos sobre la entidad destino antes de subir
  let storagePath = "";
  const safeName = `${randomUUID()}.${mimeToSafeExtension(file.type)}`;

  if (bucket === "request-documents") {
    if (!entityId) return NextResponse.json({ error: "Solicitud requerida" }, { status: 400 });
    const { data: reqRow } = await supabase
      .from("rental_requests")
      .select("id, tenant_id, status")
      .eq("id", entityId)
      .single();
    if (!reqRow || reqRow.tenant_id !== user.id) {
      return NextResponse.json({ error: "No autorizado para subir documentos a esta solicitud" }, { status: 403 });
    }
    if (reqRow.status !== "first_accepted" && reqRow.status !== "returned") {
      return NextResponse.json({ error: "La solicitud no está habilitada para recibir documentos" }, { status: 400 });
    }
    // Prefijo {request_id}/... compatible con storage.foldername(name)[1] = request_id en 0004_security_hardening.sql
    storagePath = `${reqRow.id}/${user.id}/${safeName}`;
  } else if (bucket === "payment-receipts") {
    if (!entityId) return NextResponse.json({ error: "Contrato requerido" }, { status: 400 });
    const { data: contractRow } = await supabase
      .from("contracts")
      .select("id, tenant_id, status")
      .eq("id", entityId)
      .single();
    if (!contractRow || contractRow.tenant_id !== user.id) {
      return NextResponse.json({ error: "No autorizado para subir comprobantes a este contrato" }, { status: 403 });
    }
    if (!["active", "expiring", "renewed"].includes(contractRow.status)) {
      return NextResponse.json(
        { error: `No se pueden subir comprobantes para un contrato en estado ${contractRow.status}` },
        { status: 409 }
      );
    }
    storagePath = `${user.id}/${contractRow.id}/${safeName}`;
  } else if (bucket === "identity-documents") {
    if (profile.role !== "owner") {
      return NextResponse.json({ error: "Solo propietarios pueden subir documentos de verificación" }, { status: 403 });
    }
    storagePath = `${user.id}/${safeName}`;
  }

  const admin = createAdminClient();
  const storageClient = admin ?? supabase;

  let { error: uploadErr } = await storageClient.storage
    .from(bucket)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  // Si el bucket privado (p. ej. payment-receipts o identity-documents) aún no existe en Supabase,
  // créalo en modo privado tras validar permisos y vuelve a intentar una vez.
  if (uploadErr && admin && /bucket.*not.*found/i.test(uploadErr.message)) {
    const { error: createBucketErr } = await admin.storage.createBucket(bucket, { public: false });
    if (!createBucketErr) {
      const retry = await admin.storage
        .from(bucket)
        .upload(storagePath, bytes, { contentType: file.type, upsert: false });
      uploadErr = retry.error;
    }
  }

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 400 });
  }

  return NextResponse.json({ path: storagePath });
}
