"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RentalRequest } from "@/lib/types";
import { REQUEST_STATUSES } from "@/lib/constants";
import Link from "next/link";
import Select from "@/components/ui/Select";

export default function TenantRequestsPage() {
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [filter, setFilter] = useState("");
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let q = supabase.from("rental_requests").select("*, property:properties(*)").eq("tenant_id", user.id).order("created_at", { ascending: false });
      if (filter) q = q.eq("status", filter);
      const { data } = await q;
      setRequests((data as RentalRequest[]) || []);
    })();
  }, [filter, supabase]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-primary">Mis solicitudes</h1>
      <div className="mb-4 max-w-xs">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} options={[{ value: "", label: "Todos los estados" }, ...Object.entries(REQUEST_STATUSES).map(([k, v]) => ({ value: k, label: v }))]} />
      </div>
      {requests.length === 0 && <p className="text-muted">No tienes solicitudes.</p>}
      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{r.property?.name}</p>
                <p className="text-sm text-muted">{REQUEST_STATUSES[r.status]}</p>
              </div>
              <Link href={`/tenant/requests/${r.id}`} className="text-sm text-primary hover:underline">Ver →</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
