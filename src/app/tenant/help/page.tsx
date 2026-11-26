"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HelpCircle, LifeBuoy } from "lucide-react";
import { createReport, fetchScopedReports } from "@/modules/reports/service";
import { reportCreateSchema, type ReportCreateValues } from "@/modules/reports/schemas";
import type { ReportItem } from "@/modules/reports/types";
import Accordion from "@/components/ui/Accordion";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

export default function TenantHelpPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const toast = useToast();

  const faqs = [
    { q: "¿Cómo solicito un arriendo?", a: "En el detalle de la propiedad, haz clic en 'Solicitar arriendo'." },
    { q: "¿Qué documentos necesito?", a: "Cédula, formulario diligenciado, extractos bancarios y según tu perfil laboral." },
    { q: "¿Cómo firmo el contrato?", a: "Cuando tu solicitud sea aceptada, ve a Contratos y firma con el canvas." },
  ];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReportCreateValues>({
    resolver: zodResolver(reportCreateSchema),
    mode: "onTouched",
    defaultValues: { reason: "", description: "", propertyId: "" },
  });

  const loadReports = useCallback(async () => {
    const res = await fetchScopedReports();
    if (res.ok) setReports(res.data);
    setLoadingReports(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReports();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadReports]);

  const onSubmitReport = async (values: ReportCreateValues) => {
    const res = await createReport(values);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Reporte enviado correctamente", "success");
    reset({ reason: "", description: "", propertyId: "" });
    await loadReports();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ayuda y soporte"
        subtitle="Respuestas rápidas y canal directo para reportar inconvenientes."
      />

      <Card>
        <CardHeader className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Preguntas frecuentes</h2>
        </CardHeader>
        <CardBody>
          <Accordion items={faqs} />
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold text-primary-dark">Enviar reporte</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit(onSubmitReport)} className="flex flex-col gap-3" noValidate>
              <Input
                label="Motivo"
                placeholder="Ej: Información desactualizada o problema técnico"
                required
                error={errors.reason?.message}
                {...register("reason")}
              />
              <Textarea
                label="Descripción detallada"
                rows={4}
                placeholder="Describe lo sucedido con al menos 10 caracteres..."
                required
                error={errors.description?.message}
                {...register("description")}
              />
              <Button type="submit" loading={isSubmitting}>
                Enviar reporte
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-primary-dark">Mis reportes enviados</h2>
          </CardHeader>
          <CardBody>
            {loadingReports ? (
              <div className="space-y-2">
                <div className="h-14 animate-pulse rounded-lg bg-surface-secondary" />
                <div className="h-14 animate-pulse rounded-lg bg-surface-secondary" />
              </div>
            ) : reports.length === 0 ? (
              <EmptyState
                title="Sin reportes enviados"
                message="Aquí podrás revisar el estado y respuesta de tus reportes."
              />
            ) : (
              <ul className="space-y-3 text-sm">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{r.reason || "Reporte"}</p>
                      <Badge color={r.status === "respondido" ? "green" : "yellow"}>
                        {r.status || "pendiente"}
                      </Badge>
                    </div>
                    {r.description && <p className="mt-1 text-xs text-muted">{r.description}</p>}
                    {r.response && (
                      <Alert variant="info" className="mt-2">
                        Respuesta: {r.response}
                      </Alert>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
