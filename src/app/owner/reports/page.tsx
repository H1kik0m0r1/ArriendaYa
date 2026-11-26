"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { reportResponseSchema, type ReportResponseValues } from "@/modules/reports/schemas";
import { fetchScopedReports, replyToReport } from "@/modules/reports/service";
import type { ReportItem } from "@/modules/reports/types";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingReport, setReplyingReport] = useState<ReportItem | null>(null);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReportResponseValues>({
    resolver: zodResolver(reportResponseSchema),
    mode: "onTouched",
    defaultValues: { response: "" },
  });

  const load = useCallback(async () => {
    const res = await fetchScopedReports();
    if (res.ok) setReports(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const onSubmitReply = async (values: ReportResponseValues) => {
    if (!replyingReport) return;
    const res = await replyToReport(replyingReport.id, values.response);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Respuesta registrada", "success");
    setReplyingReport(null);
    reset({ response: "" });
    await load();
  };

  return (
    <div>
      <PageHeader
        title="Gestión de reportes"
        subtitle="Consulta reportes registrados y da respuesta oportuna cuando corresponda."
      />

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-surface-secondary" />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Sin reportes"
          message="No hay reportes pendientes en este momento."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4 text-sm shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">{r.reason || "Reporte"}</p>
                <Badge color={r.status === "respondido" ? "green" : "yellow"}>
                  {r.status || "pendiente"}
                </Badge>
              </div>
              {r.description && <p className="mt-1 text-muted">{r.description}</p>}
              {r.response && (
                <p className="mt-2 rounded-lg bg-primary-light/60 px-3 py-1.5 text-xs text-primary-dark">
                  Respuesta: {r.response}
                </p>
              )}
              {!r.response && r.target_type === "property" && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    reset({ response: "" });
                    setReplyingReport(r);
                  }}
                >
                  Responder
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(replyingReport)}
        onClose={() => setReplyingReport(null)}
        title="Responder reporte"
        className="max-w-md"
      >
        <form onSubmit={handleSubmit(onSubmitReply)} className="flex flex-col gap-3" noValidate>
          <p className="text-xs text-muted">{replyingReport?.reason}</p>
          <Textarea
            label="Respuesta"
            rows={4}
            placeholder="Escribe una respuesta clara..."
            error={errors.response?.message}
            {...register("response")}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setReplyingReport(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Enviar respuesta
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
