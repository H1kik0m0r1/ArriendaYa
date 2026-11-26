import { isDemoMode } from "@/lib/config/env";
import { PRIVATE_BUCKET_RULES } from "@/lib/storage/private-files";
import { createClient } from "@/lib/supabase/client";
import { validateFile } from "@/lib/utils";
import { apiJsonFetch, errResult, okResult, type ServiceResult } from "@/modules/shared/service-result";
import { uploadPrivateFile } from "@/modules/shared/upload-client";
import { deleteExpenseRecord, insertExpenseRecord } from "./repository";
import type { ExpenseFormValues, PaymentFormValues } from "./schemas";
import type { ExpenseItem, PaymentItem } from "./types";

export function calculateConfirmedIncome(payments: PaymentItem[]): number {
  return payments
    .filter((p) => p.status === "confirmado")
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

export function calculatePendingIncome(payments: PaymentItem[]): number {
  return payments
    .filter((p) => p.status === "pendiente" || p.status === "comprobante_enviado")
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

export function calculateTotalExpenses(expenses: ExpenseItem[]): number {
  return expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
}

export async function recordOwnerCharge(
  values: PaymentFormValues,
  tenantId: string | null
): Promise<ServiceResult<true>> {
  const numericAmount = Number(values.amount);
  if (isDemoMode()) {
    const supabase = createClient();
    const { error } = await supabase.from("payments").insert({
      contract_id: values.contractId,
      tenant_id: tenantId,
      amount: numericAmount,
      concept: values.concept,
      date: new Date().toISOString(),
      status: "pendiente",
    });
    if (error) return errResult(error.message);
    return okResult(true);
  }

  const res = await apiJsonFetch("/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractId: values.contractId,
      amount: numericAmount,
      concept: values.concept,
    }),
  });
  if (!res.ok) return res;
  return okResult(true);
}

export async function recordTenantPayment(
  values: PaymentFormValues,
  receiptFile: File | null
): Promise<ServiceResult<true>> {
  let receiptPath: string | undefined;

  if (receiptFile) {
    const rules = PRIVATE_BUCKET_RULES["payment-receipts"];
    const validation = validateFile(
      receiptFile,
      rules.maxSizeBytes / (1024 * 1024),
      rules.allowedMimeTypes
    );
    if (!validation.valid) {
      return errResult(validation.error || "Archivo inválido");
    }
  }

  if (isDemoMode()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errResult("No autenticado");

    if (receiptFile) {
      const path = `${user.id}/${values.contractId}/${Date.now()}-${receiptFile.name}`;
      const { error: upErr } = await supabase.storage.from("payment-receipts").upload(path, receiptFile);
      if (upErr) return errResult(upErr.message);
      receiptPath = path;
    }

    const { error } = await supabase.from("payments").insert({
      contract_id: values.contractId,
      tenant_id: user.id,
      amount: Number(values.amount),
      concept: values.concept,
      date: new Date().toISOString(),
      status: receiptPath ? "comprobante_enviado" : "pendiente",
      receipt_url: receiptPath ?? null,
    });
    if (error) return errResult(error.message);
    return okResult(true);
  }

  if (receiptFile) {
    const uploaded = await uploadPrivateFile("payment-receipts", values.contractId, receiptFile);
    if (!uploaded.ok) return uploaded;
    receiptPath = uploaded.data;
  }

  const res = await apiJsonFetch("/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractId: values.contractId,
      amount: Number(values.amount),
      concept: values.concept,
      receiptPath,
    }),
  });
  if (!res.ok) return res;
  return okResult(true);
}

async function updatePaymentConfirmation(
  paymentId: string,
  status: "confirmado" | "rechazado"
): Promise<ServiceResult<true>> {
  if (isDemoMode()) {
    const supabase = createClient();
    const { error } = await supabase
      .from("payments")
      .update({ status })
      .eq("id", paymentId);
    if (error) return errResult(error.message);
    return okResult(true);
  }

  const res = await apiJsonFetch(`/api/payments/${paymentId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) return res;
  return okResult(true);
}

export async function confirmPayment(paymentId: string): Promise<ServiceResult<true>> {
  return updatePaymentConfirmation(paymentId, "confirmado");
}

export async function rejectPayment(paymentId: string): Promise<ServiceResult<true>> {
  return updatePaymentConfirmation(paymentId, "rechazado");
}

export async function recordOwnerExpense(values: ExpenseFormValues): Promise<ServiceResult<ExpenseItem>> {
  const { data, error } = await insertExpenseRecord({
    property_id: values.propertyId,
    type: values.type.trim(),
    amount: Number(values.amount),
    period: values.period.trim(),
  });
  if (error || !data) {
    return errResult(error?.message || "No se pudo registrar el gasto");
  }
  return okResult(data as ExpenseItem);
}

export async function removeOwnerExpense(id: string): Promise<ServiceResult<true>> {
  const { error } = await deleteExpenseRecord(id);
  if (error) return errResult(error.message);
  return okResult(true);
}
