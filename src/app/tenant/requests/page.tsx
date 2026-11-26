"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { REQUEST_STATUSES } from "@/lib/constants";
import { listTenantRequests } from "@/modules/rental-requests/repository";
import type { RentalRequest } from "@/modules/rental-requests/types";
import { getRequestStatusBadge } from "@/modules/shared/status-badges";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";

export default function TenantRequestsPage() {
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [filter, setFilter] = useState("");
  const [loadedFilter, setLoadedFilter] = useState<string | null>(null);
  const loading = loadedFilter !== filter;

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const data = await listTenantRequests(user.id, filter || undefined);
        if (active) setRequests(data);
      } finally {
        if (active) setLoadedFilter(filter);
      }
    })();
    return () => {
      active = false;
    };
  }, [filter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis solicitudes"
        subtitle="Consulta el avance de cada postulación y sube los documentos requeridos."
        actions={
          <div className="w-full sm:w-64">
            <Select
              aria-label="Filtrar solicitudes por estado"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              options={[
                { value: "", label: "Todos los estados" },
                ...Object.entries(REQUEST_STATUSES).map(([k, v]) => ({ value: k, label: v })),
              ]}
            />
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-surface-secondary" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="No tienes solicitudes"
          message={
            filter
              ? "No hay solicitudes que coincidan con el estado seleccionado."
              : "Cuando solicites una propiedad aparecerá aquí su seguimiento."
          }
          action={
            <Link
              href="/"
              className="inline-flex min-h-[40px] items-center rounded-lg bg-primary-btn px-4 py-2 text-sm font-medium text-white hover:bg-primary-btn-hover"
            >
              Explorar propiedades
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => {
            const badge = getRequestStatusBadge(r.status);
            return (
              <li key={r.id}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-primary-dark">
                        {r.property?.name || "Propiedad"}
                      </p>
                      <Badge color={badge.color}>{badge.label}</Badge>
                    </div>
                    <Link
                      href={`/tenant/requests/${r.id}`}
                      className="inline-flex min-h-[38px] items-center gap-1.5 self-start rounded-lg border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-primary hover:bg-primary-light/60 sm:self-auto"
                    >
                      <span>Ver detalle</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
