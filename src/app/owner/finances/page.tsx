"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import MoneyInput from "@/components/ui/MoneyInput";

export default function FinancesPage() {
  const supabase = createClient();
  const [payments, setPayments] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");

  // calculator
  const [calcPrice, setCalcPrice] = useState("");
  const [calcDays, setCalcDays] = useState("");
  const [calcDiscount, setCalcDiscount] = useState("");
  const total = (Number(calcPrice) || 0) * (Number(calcDays) || 0) * (1 - (Number(calcDiscount) || 0) / 100);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("payments").select("*").order("date", { ascending: false });
      setPayments(data || []);
    })();
  }, [supabase]);

  const addPayment = async () => {
    if (!amount) return;
    await supabase.from("payments").insert({ amount: Number(amount), concept, date: new Date().toISOString(), status: "pendiente" });
    const { data } = await supabase.from("payments").select("*").order("date", { ascending: false });
    setPayments(data || []);
    setAmount("");
    setConcept("");
  };

  const confirm = async (id: string) => {
    await supabase.from("payments").update({ status: "confirmado" }).eq("id", id);
    const { data } = await supabase.from("payments").select("*").order("date", { ascending: false });
    setPayments(data || []);
  };

  const income = payments.filter((p) => p.status === "confirmado").reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Finanzas</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Ingresos confirmados</h2>
          <p className="text-2xl font-bold text-primary">${income.toLocaleString("es-CO")}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 font-semibold">Registrar pago</h2>
          <div className="flex flex-col gap-2">
            <Input label="Concepto" value={concept} onChange={(e) => setConcept(e.target.value)} />
            <MoneyInput label="Monto" value={amount} onChange={setAmount} />
            <Button onClick={addPayment}>Registrar</Button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Pagos</h2>
        <ul className="flex flex-col gap-2">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span>{p.concept || "Pago"} — ${p.amount.toLocaleString("es-CO")} — {new Date(p.date).toLocaleDateString("es-CO")}</span>
              <span className={p.status === "confirmado" ? "text-green-600" : "text-yellow-600"}>
                {p.status}
                {p.status !== "confirmado" && (
                  <button onClick={() => confirm(p.id)} className="ml-2 text-primary hover:underline">Confirmar</button>
                )}
              </span>
            </li>
          ))}
          {payments.length === 0 && <li className="text-muted">Sin pagos.</li>}
        </ul>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Calculadora de arrendamiento</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <Input label="Precio" inputMode="numeric" value={calcPrice} onChange={(e) => setCalcPrice(e.target.value.replace(/\D/g, ""))} />
          <Input label="Días" inputMode="numeric" value={calcDays} onChange={(e) => setCalcDays(e.target.value.replace(/\D/g, ""))} />
          <Input label="Descuento %" inputMode="numeric" value={calcDiscount} onChange={(e) => setCalcDiscount(e.target.value.replace(/\D/g, ""))} />
        </div>
        <p className="mt-3 text-lg font-bold text-primary">Total: ${total.toLocaleString("es-CO")}</p>
      </div>
    </div>
  );
}
