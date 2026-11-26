import { createClient } from "@/lib/supabase/client";
import type { Property } from "@/modules/properties/types";
import type { Contract } from "./types";

export async function listUserContracts(userId: string): Promise<Contract[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("contracts")
    .select("*, property:properties(*)")
    .or(`tenant_id.eq.${userId},owner_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  return (data as Contract[] | null) ?? [];
}

export async function getContractDetail(contractId: string): Promise<{
  contract: Contract | null;
  property: Property | null;
  currentUserId: string | null;
}> {
  const supabase = createClient();
  const { data: c } = await supabase.from("contracts").select("*").eq("id", contractId).single();
  const contract = (c as Contract | null) ?? null;
  if (!contract) {
    return { contract: null, property: null, currentUserId: null };
  }

  const [{ data: p }, { data: { user } }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", contract.property_id).single(),
    supabase.auth.getUser(),
  ]);

  return {
    contract,
    property: (p as Property | null) ?? null,
    currentUserId: user?.id ?? null,
  };
}
