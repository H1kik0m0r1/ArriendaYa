import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { paymentCreateSchema } from "@/lib/validators/schemas";
import {
  hasServerNotificationCapability,
  insertServerNotifications,
} from "@/lib/notifications/server-notify";

const PAYABLE_CONTRACT_STATUSES = ["active", "expiring", "renewed"] as const;
const RECEIPT_FILENAME_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$/i;

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner", "tenant", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = paymentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
  }

  if (!hasServerNotificationCapability()) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para notificar el registro de pagos." },
      { status: 503 }
    );
  }

  const { contractId, amount, concept, receiptPath } = parsed.data;
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, owner_id, tenant_id, status")
    .eq("id", contractId)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
  }

  if (!PAYABLE_CONTRACT_STATUSES.includes(contract.status as (typeof PAYABLE_CONTRACT_STATUSES)[number])) {
    return NextResponse.json(
      { error: `No se pueden registrar pagos en un contrato en estado ${contract.status}` },
      { status: 409 }
    );
  }

  const isOwner = contract.owner_id === user.id && (profile.role === "owner" || profile.role === "admin");
  const isTenant = contract.tenant_id === user.id;

  if (!isOwner && !isTenant) {
    return NextResponse.json({ error: "No perteneces a este contrato" }, { status: 403 });
  }

  if (receiptPath) {
    if (!isTenant) {
      return NextResponse.json({ error: "Solo el inquilino puede adjuntar comprobantes de pago" }, { status: 403 });
    }
    if (
      receiptPath.includes("..") ||
      receiptPath.includes("\\") ||
      receiptPath.includes("%") ||
      receiptPath.includes("\0") ||
      receiptPath.startsWith("/")
    ) {
      return NextResponse.json({ error: "Ruta de comprobante inválida" }, { status: 400 });
    }
    const segments = receiptPath.split("/");
    const expectedPrefix = `${user.id}/${contract.id}`;
    if (
      segments.length !== 3 ||
      `${segments[0]}/${segments[1]}` !== expectedPrefix ||
      !RECEIPT_FILENAME_REGEX.test(segments[2])
    ) {
      return NextResponse.json({ error: "Ruta de comprobante no autorizada" }, { status: 403 });
    }
    const fileName = segments[2];
    const storageClient = createAdminClient() ?? supabase;
    const { data: listed, error: listErr } = await storageClient.storage
      .from("payment-receipts")
      .list(expectedPrefix, { search: fileName });

    if (listErr || !listed?.some((f: { name: string }) => f.name === fileName)) {
      return NextResponse.json({ error: "El comprobante indicado no existe en Storage" }, { status: 400 });
    }
  }

  const initialStatus = isTenant && receiptPath ? "comprobante_enviado" : "pendiente";

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      contract_id: contract.id,
      tenant_id: contract.tenant_id,
      amount,
      concept,
      date: new Date().toISOString(),
      status: initialStatus,
      receipt_url: receiptPath ?? null,
    })
    .select("*")
    .single();

  if (error || !payment) {
    return NextResponse.json({ error: error?.message || "No se pudo registrar el pago" }, { status: 400 });
  }

  const targetUserId = isTenant ? contract.owner_id : contract.tenant_id;
  const notifRes = await insertServerNotifications([
    {
      user_id: targetUserId,
      type: "payment_recorded",
      title: isTenant ? "Pago / comprobante registrado" : "Nuevo cobro registrado",
      message: `${concept} — $${amount.toLocaleString("es-CO")}`,
      link: isTenant ? "/owner/finances" : "/tenant/finances",
    },
  ]);

  if (!notifRes.ok) {
    const admin = createAdminClient();
    let rolledBack = false;
    if (admin) {
      const { error: delErr } = await admin.from("payments").delete().eq("id", payment.id);
      if (delErr) {
        console.error("[payments] Error revirtiendo pago tras fallo de notificación:", delErr.message);
      } else {
        rolledBack = true;
        if (receiptPath) {
          const { data: remainingRefs } = await admin
            .from("payments")
            .select("id")
            .eq("receipt_url", receiptPath)
            .limit(1);
          if (!remainingRefs || remainingRefs.length === 0) {
            const { error: rmErr } = await admin.storage.from("payment-receipts").remove([receiptPath]);
            if (rmErr) {
              console.error("[payments] No se pudo limpiar el comprobante huérfano:", rmErr.message);
            }
          }
        }
      }
    }
    return NextResponse.json(
      {
        error: rolledBack
          ? notifRes.error
          : `Falló la notificación (${notifRes.error}) y no se pudo revertir el pago registrado.`,
        rolledBack,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ payment }, { status: 201 });
}
