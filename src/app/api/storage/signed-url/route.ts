import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrlSchema } from "@/lib/validators/schemas";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_SEGMENT_REGEX = /^[a-zA-Z0-9._-]+$/;

function isValidStoragePath(path: string): boolean {
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("%") ||
    path.includes("\0") ||
    path.includes("//")
  ) {
    return false;
  }
  const parts = path.split("/");
  return parts.length >= 2 && parts.every((seg) => seg.length > 0 && SAFE_SEGMENT_REGEX.test(seg));
}

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = signedUrlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud de archivo inválida" }, { status: 400 });
  }

  const { bucket, path } = parsed.data;
  if (!isValidStoragePath(path)) {
    return NextResponse.json({ error: "Ruta de archivo inválida o manipulada" }, { status: 400 });
  }

  const segments = path.split("/");
  const isAdmin = profile.role === "admin";
  let authorized = false;

  if (bucket === "request-documents") {
    if (segments.length === 3 && UUID_REGEX.test(segments[0]) && UUID_REGEX.test(segments[1])) {
      // Soportar ruta canonica {request_id}/{tenant_id}/{file} y heredada {tenant_id}/{request_id}/{file}
      const { data: canonicalRow } = await supabase
        .from("rental_requests")
        .select("id, tenant_id, property:properties(owner_id)")
        .eq("id", segments[0])
        .maybeSingle();

      const reqRow =
        canonicalRow ||
        (
          await supabase
            .from("rental_requests")
            .select("id, tenant_id, property:properties(owner_id)")
            .eq("id", segments[1])
            .maybeSingle()
        ).data;

      if (reqRow) {
        const tenantSegment = reqRow.id === segments[0] ? segments[1] : segments[0];
        const ownerId = (reqRow.property as { owner_id?: string } | null)?.owner_id;
        authorized = Boolean(
          reqRow.tenant_id === tenantSegment &&
          (isAdmin || reqRow.tenant_id === user.id || ownerId === user.id)
        );
      }
    } else if (segments.length === 2 && UUID_REGEX.test(segments[0])) {
      const { data: reqRow } = await supabase
        .from("rental_requests")
        .select("id, tenant_id, property:properties(owner_id)")
        .eq("id", segments[0])
        .maybeSingle();
      const ownerId = (reqRow?.property as { owner_id?: string } | null)?.owner_id;
      authorized = Boolean(
        reqRow && (isAdmin || reqRow.tenant_id === user.id || ownerId === user.id)
      );
    } else {
      return NextResponse.json({ error: "Estructura de ruta inválida para documentos" }, { status: 400 });
    }
  } else if (bucket === "signatures") {
    const isHistorical = segments.length === 3 && segments[0] === "signatures";
    const isCurrent = segments.length === 2;
    if (!isHistorical && !isCurrent) {
      return NextResponse.json({ error: "Estructura de ruta inválida para firmas" }, { status: 400 });
    }
    const contractId = isHistorical ? segments[1] : segments[0];
    if (!UUID_REGEX.test(contractId)) {
      return NextResponse.json({ error: "Identificador de contrato inválido" }, { status: 400 });
    }
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, owner_id, tenant_id")
      .eq("id", contractId)
      .single();
    authorized = Boolean(
      contract && (isAdmin || contract.owner_id === user.id || contract.tenant_id === user.id)
    );
  } else if (bucket === "payment-receipts") {
    if (segments.length !== 3 || !UUID_REGEX.test(segments[0]) || !UUID_REGEX.test(segments[1])) {
      return NextResponse.json({ error: "Estructura de ruta inválida para comprobantes" }, { status: 400 });
    }
    const [tenantSegment, contractId] = segments;
    const { data: contract } = await supabase
      .from("contracts")
      .select("id, owner_id, tenant_id")
      .eq("id", contractId)
      .single();
    authorized = Boolean(
      contract &&
      contract.tenant_id === tenantSegment &&
      (isAdmin || contract.owner_id === user.id || contract.tenant_id === user.id)
    );
  } else if (bucket === "identity-documents") {
    if (segments.length !== 2 || !UUID_REGEX.test(segments[0])) {
      return NextResponse.json({ error: "Estructura de ruta inválida para verificación" }, { status: 400 });
    }
    authorized = isAdmin || segments[0] === user.id;
  }

  if (!authorized) {
    return NextResponse.json({ error: "No autorizado para acceder a este archivo privado" }, { status: 403 });
  }

  const storageClient = createAdminClient() ?? supabase;
  const { data, error } = await storageClient.storage.from(bucket).createSignedUrl(path, 120);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || "No se pudo firmar la URL" }, { status: 404 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, expiresIn: 120 });
}
