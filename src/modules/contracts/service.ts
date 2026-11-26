import { isDemoMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";
import { apiJsonFetch, errResult, okResult, type ServiceResult } from "@/modules/shared/service-result";
import type { ContractTermsValues } from "./schemas";
import type { Contract } from "./types";

export async function saveContractTerms(
  contractId: string,
  values: ContractTermsValues
): Promise<ServiceResult<true>> {
  if (isDemoMode()) {
    const supabase = createClient();
    const { error } = await supabase
      .from("contracts")
      .update({
        terms: values.terms,
        start_date: values.startDate || null,
        end_date: values.endDate || null,
      })
      .eq("id", contractId);
    if (error) return errResult(error.message);
    return okResult(true);
  }

  const res = await apiJsonFetch(`/api/contracts/${contractId}/terms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  if (!res.ok) return res;
  return okResult(true);
}

export async function signContract(
  contractId: string,
  role: "owner" | "tenant",
  dataUrl: string
): Promise<ServiceResult<{ finalized: boolean }>> {
  if (isDemoMode()) {
    const supabase = createClient();
    const path = `${contractId}/${role}-${crypto.randomUUID()}.png`;
    const blob = await (await fetch(dataUrl)).blob();
    const { error: upErr } = await supabase.storage.from("signatures").upload(path, blob);
    if (upErr) return errResult(upErr.message);

    const update = role === "owner" ? { owner_signature_url: path } : { tenant_signature_url: path };
    const { error: sigErr } = await supabase.from("contracts").update(update).eq("id", contractId);
    if (sigErr) return errResult(sigErr.message);

    const { data: latest } = await supabase.from("contracts").select("*").eq("id", contractId).single();
    const c = latest as Contract | null;
    const finalized = Boolean(c && c.owner_signature_url && c.tenant_signature_url);
    if (finalized && c) {
      await supabase.from("properties").update({ status: "rented" }).eq("id", c.property_id);
      if (c.request_id) await supabase.from("rental_requests").update({ status: "accepted" }).eq("id", c.request_id);
    }
    return okResult({ finalized });
  }

  const res = await apiJsonFetch<{ finalized?: boolean }>(`/api/contracts/${contractId}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signatureDataUrl: dataUrl }),
  });
  if (!res.ok) return res;
  return okResult({ finalized: Boolean(res.data.finalized) });
}

export async function runContractLifecycleAction(
  contract: Contract,
  action: "renew" | "suspend"
): Promise<ServiceResult<true>> {
  if (isDemoMode()) {
    const supabase = createClient();
    if (action === "renew") {
      const newEnd = new Date(contract.end_date || new Date());
      newEnd.setMonth(newEnd.getMonth() + 12);
      const { error } = await supabase
        .from("contracts")
        .update({
          end_date: newEnd.toISOString().slice(0, 10),
          reminder_month_sent: false,
          reminder_week_sent: false,
          status: "active",
        })
        .eq("id", contract.id);
      if (error) return errResult(error.message);
    } else {
      const { error } = await supabase.from("contracts").update({ status: "suspended" }).eq("id", contract.id);
      if (error) return errResult(error.message);
      await supabase.from("properties").update({ status: "published" }).eq("id", contract.property_id);
    }
    return okResult(true);
  }

  const res = await apiJsonFetch(`/api/contracts/${contract.id}/lifecycle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) return res;
  return okResult(true);
}
