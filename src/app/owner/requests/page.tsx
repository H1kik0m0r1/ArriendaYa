"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { REQUEST_STATUSES } from "@/lib/constants";
import { listOwnerRequests } from "@/modules/rental-requests/repository";
import type { RentalRequest } from "@/modules/rental-requests/types";
import { getRequestStatusBadge } from "@/modules/shared/status-badges";
import { Badge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";

export default function OwnerRequestsPage() {
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setRequests(await listOwnerRequests(user.id, filter || undefined));
      setLoading(false);
    })();
  }, [filter]);

  return (
    <div>
      <PageHeader
        title="Solicitudes recibidas"
        subtitle="Revisa postulaciones, aprueba filtros iniciales y gestiona entregas documentales."
      />
      <div className="mb-4 max-w-xs">
        <Select
          label="Filtrar por estado"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          options={[
            { value: "", label: "Todos los estados" },
            ...Object.entries(REQUEST_STATUSES).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-2xl bg-surface-secondary" />
          <div className="h-20 animate-pulse rounded-2xl bg-surface-secondary" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="No hay solicitudes"
          message={filter ? "No hay solicitudes para el estado seleccionado." : "Aún no has recibido solicitudes para tus propiedades."}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => {
            const badge = getRequestStatusBadge(r.status);
            return (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-xs">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{r.property?.name || "Inmueble"}</p>
                      <Badge color={badge.color}>{badge.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      Inquilino: {r.tenant_id.slice(0, 8)}…
                      {r.first_deadline &&
                        !Number.isNaN(new Date(r.first_deadline).getTime()) &&
                        ` · Vence: ${new Date(r.first_deadline).toLocaleDateString("es-CO")}`}
                    </p>
                  </div>
                  <Link
                    href={`/owner/requests/${r.id}`}
                    className="self-start rounded-lg border border-primary/30 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 sm:self-auto"
                  >
                    Gestionar →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
