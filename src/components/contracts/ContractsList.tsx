"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Contract } from "@/lib/types";
import Link from "next/link";

export default function ContractsList() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("contracts")
        .select("*, property:properties(*)")
        .or(`tenant_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      setContracts((data as Contract[]) || []);
    })();
  }, [supabase]);

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-primary">Contratos</h1>
      {contracts.length === 0 && <p className="text-muted">No tienes contratos.</p>}
      <ul className="flex flex-col gap-3">
        {contracts.map((c) => (
          <li key={c.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{c.property?.name}</p>
                <p className="text-sm text-muted">Estado: {c.status}</p>
                {c.end_date && <p className="text-xs text-muted">Vence: {new Date(c.end_date).toLocaleDateString("es-CO")}</p>}
              </div>
              <Link href={`/contracts/${c.id}`} className="text-sm text-primary hover:underline">Ver/Firmar →</Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
