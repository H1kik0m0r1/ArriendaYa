"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileSignature } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listUserContracts } from "@/modules/contracts/repository";
import type { Contract } from "@/modules/contracts/types";
import { getContractStatusBadge } from "@/modules/shared/status-badges";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";

export default function ContractsList() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setContracts(await listUserContracts(user.id));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        subtitle="Revisa términos, fechas de vigencia y registra tu firma digital."
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-surface-secondary" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState
          title="No tienes contratos"
          message="Cuando se apruebe una solicitud, el contrato correspondiente aparecerá aquí."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {contracts.map((c) => {
            const statusBadge = getContractStatusBadge(c.status);
            return (
              <li key={c.id}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileSignature className="h-4 w-4 text-primary" aria-hidden="true" />
                        <p className="font-semibold text-primary-dark">
                          {c.property?.name || "Contrato de arriendo"}
                        </p>
                        <Badge color={statusBadge.color}>{statusBadge.label}</Badge>
                      </div>
                      {c.end_date && (
                        <p className="text-xs text-muted">
                          Vence: {new Date(c.end_date).toLocaleDateString("es-CO")}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/contracts/${c.id}`}
                      className="inline-flex min-h-[38px] items-center gap-1.5 self-start rounded-lg bg-primary-btn px-3.5 py-1.5 text-sm font-medium text-white hover:bg-primary-btn-hover sm:self-auto"
                    >
                      <span>Ver / Firmar</span>
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
