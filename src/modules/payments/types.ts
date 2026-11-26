export type PaymentStatus = "pendiente" | "comprobante_enviado" | "confirmado" | "rechazado" | string;

export interface PaymentItem {
  id: string;
  contract_id: string | null;
  tenant_id: string | null;
  amount: number;
  concept: string | null;
  date: string;
  status: PaymentStatus;
  receipt_url?: string | null;
}

export interface ContractOption {
  id: string;
  tenant_id?: string;
  property?: { name?: string } | null;
}

export interface ExpenseItem {
  id: string;
  property_id: string | null;
  type: string | null;
  amount: number | null;
  period: string | null;
  created_at: string;
}

export interface OwnerPropertyOption {
  id: string;
  name: string;
}
