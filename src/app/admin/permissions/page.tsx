"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ROLES_PERMISSIONS_MATRIX } from "@/modules/admin/permissions-matrix";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";

type FocusRole = "all" | "admin" | "owner" | "tenant" | "anonymous";

export default function AdminPermissionsPage() {
  const [roleFocus, setRoleFocus] = useState<FocusRole>("all");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles y matriz de permisos"
        subtitle="Control de acceso integral aplicado en proxy, rutas API, políticas RLS, Storage y triggers de PostgreSQL."
      />

      <Alert variant="info" title="Defensa en profundidad activa">
        Los permisos no dependen solo de ocultar botones en la interfaz: cada capacidad se valida en <code>proxy.ts</code>, <code>requirePageRole</code>, <code>requireApiAuth</code>, políticas RLS de Supabase y triggers en base de datos.
      </Alert>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "all" as const, label: "Todos los roles" },
          { id: "admin" as const, label: "Administrador" },
          { id: "owner" as const, label: "Propietario" },
          { id: "tenant" as const, label: "Inquilino" },
          { id: "anonymous" as const, label: "Visitante anónimo" },
        ].map((btn) => (
          <Button
            key={btn.id}
            type="button"
            size="sm"
            variant={roleFocus === btn.id ? "primary" : "secondary"}
            onClick={() => setRoleFocus(btn.id)}
          >
            {btn.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {ROLES_PERMISSIONS_MATRIX.map((row) => (
          <div key={row.capability} className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>{row.capability}</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">Alcance: {row.scope}</p>
              </div>
              <Badge color="blue">{row.enforcement}</Badge>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(roleFocus === "all" || roleFocus === "admin") && (
                <div className="rounded-xl border border-border bg-surface-secondary p-2.5 text-xs">
                  <p className="font-semibold text-primary-dark">Administrador</p>
                  <p className="mt-1 text-muted">{row.admin}</p>
                </div>
              )}
              {(roleFocus === "all" || roleFocus === "owner") && (
                <div className="rounded-xl border border-border bg-surface-secondary p-2.5 text-xs">
                  <p className="font-semibold text-foreground">Propietario</p>
                  <p className="mt-1 text-muted">{row.owner}</p>
                </div>
              )}
              {(roleFocus === "all" || roleFocus === "tenant") && (
                <div className="rounded-xl border border-border bg-surface-secondary p-2.5 text-xs">
                  <p className="font-semibold text-foreground">Inquilino</p>
                  <p className="mt-1 text-muted">{row.tenant}</p>
                </div>
              )}
              {(roleFocus === "all" || roleFocus === "anonymous") && (
                <div className="rounded-xl border border-border bg-surface-secondary p-2.5 text-xs">
                  <p className="font-semibold text-foreground">Anónimo</p>
                  <p className="mt-1 text-muted">{row.anonymous}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
