"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function TenantFinancesPage() {
  const supabase = createClient();
  const [payments, setPayments] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: cons } = await supabase.from("contracts").select("id").eq("tenant_id", user.id);
      const ids = (cons || []).map((c: any) => c.id);
      const { data } = await supabase.from("payments").select("*").in("contract_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      setPayments(data || []);
    })();
  }, [supabase]);

  const addPayment = async () => {
    if (!amount) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: cons } = await supabase.from("contracts").select("id").eq("tenant_id", user.id).limit(1);
    const contractId = cons?.[0]?.id || null;
    await supabase.from("payments").insert({ contract_id: contractId, amount: Number(amount), concept, date: new Date().toISOString(), status: "pendiente" });
    const { data } = await supabase.from("payments").select("*").eq("tenant_id", user.id);
    setPayments(data || []);
    setAmount("");
    setConcept("");
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Mis pagos y gastos</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Registrar pago</h2>
          <div className="flex flex-col gap-2">
            <Input label="Concepto" value={concept} onChange={(e) => setConcept(e.target.value)} />
            <Input label="Monto" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
            <Button onClick={addPayment}>Registrar</Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Historial de pagos</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.concept || "Pago"} — ${p.amount.toLocaleString("es-CO")}</span>
                <span className="text-muted">{new Date(p.date).toLocaleDateString("es-CO")}</span>
              </li>
            ))}
            {payments.length === 0 && <li className="text-muted">Sin pagos.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
