"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function TenantDashboardPage() {
  const [reqCount, setReqCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: reqs } = await supabase.from("rental_requests").select("*").eq("tenant_id", user.id);
      setReqCount(reqs?.length || 0);
    })();
  }, [supabase]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Panel del inquilino</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted">Solicitudes</p>
          <p className="text-2xl font-bold">{reqCount}</p>
          <Link href="/tenant/requests" className="text-sm text-primary hover:underline">Ver →</Link>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted">Contratos</p>
          <Link href="/contracts" className="text-sm text-primary hover:underline">Ver →</Link>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted">Guardados</p>
          <Link href="/tenant/saved" className="text-sm text-primary hover:underline">Ver →</Link>
        </div>
      </div>
    </div>
  );
}
