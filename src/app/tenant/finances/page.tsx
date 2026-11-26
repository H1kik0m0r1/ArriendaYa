"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Printer, Receipt, Wallet } from "lucide-react";
import { resolvePrivateFileUrl } from "@/lib/storage/private-files";
import { listFinancesData } from "@/modules/payments/repository";
import { paymentFormSchema, type PaymentFormValues } from "@/modules/payments/schemas";
import { recordTenantPayment } from "@/modules/payments/service";
import type { ContractOption, PaymentItem } from "@/modules/payments/types";
import { getPaymentStatusBadge } from "@/modules/shared/status-badges";
import Alert from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

export default function TenantFinancesPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    mode: "onTouched",
    defaultValues: { contractId: "", concept: "", amount: "" },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { contracts: conList, payments: payList } = await listFinancesData("tenant");
      setContracts(conList);
      setPayments(payList);
      if (!getValues("contractId") && conList[0]?.id) {
        setValue("contractId", conList[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [getValues, setValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const onAddPayment = async (values: PaymentFormValues) => {
    const res = await recordTenantPayment(values, receiptFile);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Registro enviado. Pendiente de confirmación del propietario.", "success");
    reset({ contractId: values.contractId, concept: "", amount: "" });
    setReceiptFile(null);
    await loadData();
  };

  const openReceipt = async (path: string) => {
    const url = await resolvePrivateFileUrl("payment-receipts", path);
    if (!url) {
      toast.show("No se pudo abrir el comprobante", "error");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const amountField = register("amount");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis pagos y gastos"
        subtitle="Reporta tus pagos con soporte de comprobante y haz seguimiento a la confirmación del propietario."
        actions={
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="no-print"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span>Imprimir / Guardar PDF</span>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold text-primary-dark">Registrar pago</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {!loading && contracts.length === 0 && (
              <Alert variant="info">
                Necesitas un contrato activo o registrado para reportar pagos.
              </Alert>
            )}
            <form onSubmit={handleSubmit(onAddPayment)} className="flex flex-col gap-3" noValidate>
              <Select
                label="Contrato"
                error={errors.contractId?.message}
                options={
                  contracts.length > 0
                    ? contracts.map((c) => ({
                        value: c.id,
                        label: `${c.property?.name || "Contrato"} (${c.id.slice(0, 8)})`,
                      }))
                    : [{ value: "", label: "Sin contratos disponibles" }]
                }
                {...register("contractId")}
              />
              <Input
                label="Concepto"
                placeholder="Ej. Canon mes de marzo"
                error={errors.concept?.message}
                {...register("concept")}
              />
              <Input
                label="Monto (COP)"
                placeholder="Ej. 1500000"
                inputMode="numeric"
                error={errors.amount?.message}
                {...amountField}
                onChange={(e) => setValue("amount", e.target.value.replace(/\D/g, ""), { shouldValidate: true })}
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Comprobante opcional (PDF, JPG, PNG, WEBP)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-light file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-dark hover:file:bg-primary-light/80"
                />
              </div>
              <Button type="submit" loading={isSubmitting} disabled={!contracts.length}>
                Registrar pago
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold text-primary-dark">Historial de pagos</h2>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-secondary" />
                ))}
              </div>
            ) : payments.length === 0 ? (
              <EmptyState
                title="Sin pagos registrados"
                message="Tus reportes de pago aparecerán aquí con su estado de confirmación."
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {payments.map((p) => {
                  const statusBadge = getPaymentStatusBadge(p.status);
                  return (
                    <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{p.concept || "Pago"}</span>
                          <Badge color={statusBadge.color}>{statusBadge.label}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                          <span className="font-semibold text-primary-dark">
                            ${Number(p.amount).toLocaleString("es-CO")}
                          </span>
                          <span>{new Date(p.date).toLocaleDateString("es-CO")}</span>
                        </div>
                      </div>
                      {p.receipt_url && (
                        <button
                          type="button"
                          onClick={() => void openReceipt(p.receipt_url!)}
                          className="inline-flex min-h-[34px] items-center gap-1 self-start rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-light/60 sm:self-auto"
                        >
                          <span>Comprobante</span>
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
