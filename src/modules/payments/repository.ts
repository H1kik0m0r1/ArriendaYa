import { createClient } from "@/lib/supabase/client";
import type { ContractOption, ExpenseItem, OwnerPropertyOption, PaymentItem } from "./types";

export async function listFinancesData(role: "owner" | "tenant"): Promise<{
  contracts: ContractOption[];
  payments: PaymentItem[];
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { contracts: [], payments: [] };

  const filterCol = role === "owner" ? "owner_id" : "tenant_id";
  const selectCols = role === "owner" ? "id, tenant_id, property:properties(name)" : "id, property:properties(name)";

  const { data: cons } = await supabase
    .from("contracts")
    .select(selectCols)
    .eq(filterCol, user.id);

  const contracts = (cons as ContractOption[] | null) ?? [];
  const ids = contracts.map((c) => c.id);
  if (ids.length === 0) return { contracts, payments: [] };

  const { data: pays } = await supabase
    .from("payments")
    .select("*")
    .in("contract_id", ids)
    .order("date", { ascending: false });

  return {
    contracts,
    payments: (pays as PaymentItem[] | null) ?? [],
  };
}

export async function listOwnerFinancesExtras(): Promise<{
  properties: OwnerPropertyOption[];
  expenses: ExpenseItem[];
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { properties: [], expenses: [] };

  const { data: props } = await supabase
    .from("properties")
    .select("id, name")
    .eq("owner_id", user.id)
    .order("name", { ascending: true });

  const properties = (props as OwnerPropertyOption[] | null) ?? [];
  const ids = properties.map((p) => p.id);
  if (ids.length === 0) return { properties, expenses: [] };

  const { data: exps } = await supabase
    .from("expenses")
    .select("*")
    .in("property_id", ids)
    .order("created_at", { ascending: false });

  return {
    properties,
    expenses: (exps as ExpenseItem[] | null) ?? [],
  };
}

export async function insertExpenseRecord(payload: {
  property_id: string;
  type: string;
  amount: number;
  period: string;
}) {
  const supabase = createClient();
  return supabase.from("expenses").insert(payload).select("*").single();
}

export async function deleteExpenseRecord(id: string) {
  const supabase = createClient();
  return supabase.from("expenses").delete().eq("id", id);
}
