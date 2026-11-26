"use client";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Printer, Receipt, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { resolvePrivateFileUrl } from "@/lib/storage/private-files";
import { listFinancesData, listOwnerFinancesExtras } from "@/modules/payments/repository";
import {
  expenseFormSchema,
  paymentFormSchema,
  type ExpenseFormValues,
  type PaymentFormValues,
} from "@/modules/payments/schemas";
import {
  calculateConfirmedIncome,
  calculatePendingIncome,
  calculateTotalExpenses,
  confirmPayment,
  recordOwnerCharge,
  recordOwnerExpense,
  rejectPayment,
  removeOwnerExpense,
} from "@/modules/payments/service";
import type { ContractOption, ExpenseItem, OwnerPropertyOption, PaymentItem } from "@/modules/payments/types";
import { getPaymentStatusBadge } from "@/modules/shared/status-badges";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import MoneyInput from "@/components/ui/MoneyInput";
import PageHeader from "@/components/ui/PageHeader";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

export default function FinancesPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [properties, setProperties] = useState<OwnerPropertyOption[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [rejectTarget, setRejectTarget] = useState<PaymentItem | null>(null);
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseItem | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const toast = useToast();

  // calculator
  const [calcPrice, setCalcPrice] = useState("");
  const [calcDays, setCalcDays] = useState("");
  const [calcDiscount, setCalcDiscount] = useState("");
  const total = (Number(calcPrice) || 0) * (Number(calcDays) || 0) * (1 - (Number(calcDiscount) || 0) / 100);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    mode: "onTouched",
    defaultValues: { contractId: "", concept: "", amount: "" },
  });

  const {
    register: registerExp,
    handleSubmit: handleExpSubmit,
    control: expControl,
    getValues: getExpValues,
    setValue: setExpValue,
    reset: resetExp,
    formState: { errors: expErrors, isSubmitting: savingExp },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    mode: "onTouched",
    defaultValues: { propertyId: "", type: "", amount: "", period: new Date().toISOString().slice(0, 7) },
  });

  const loadData = useCallback(async () => {
    const [{ contracts: conList, payments: payList }, { properties: propList, expenses: expList }] =
      await Promise.all([listFinancesData("owner"), listOwnerFinancesExtras()]);
    setContracts(conList);
    setPayments(payList);
    setProperties(propList);
    setExpenses(expList);
    if (!getValues("contractId") && conList[0]?.id) {
      setValue("contractId", conList[0].id);
    }
    if (!getExpValues("propertyId") && propList[0]?.id) {
      setExpValue("propertyId", propList[0].id);
    }
  }, [getExpValues, getValues, setExpValue, setValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const onAddPayment = async (values: PaymentFormValues) => {
    const target = contracts.find((c) => c.id === values.contractId);
    const res = await recordOwnerCharge(values, target?.tenant_id ?? null);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Cobro registrado", "success");
    reset({ contractId: values.contractId, concept: "", amount: "" });
    await loadData();
  };

  const onAddExpense = async (values: ExpenseFormValues) => {
    const res = await recordOwnerExpense(values);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Gasto registrado", "success");
    resetExp({ propertyId: values.propertyId, type: "", amount: "", period: values.period });
    await loadData();
  };

  const handleConfirm = async (id: string) => {
    const res = await confirmPayment(id);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Pago confirmado", "success");
    await loadData();
  };

  const onConfirmReject = async () => {
    if (!rejectTarget) return;
    setBusyAction(true);
    const res = await rejectPayment(rejectTarget.id);
    setBusyAction(false);
    setRejectTarget(null);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Pago marcado como rechazado", "info");
    await loadData();
  };

  const onConfirmDeleteExpense = async () => {
    if (!deleteExpenseTarget) return;
    setBusyAction(true);
    const res = await removeOwnerExpense(deleteExpenseTarget.id);
    setBusyAction(false);
    setDeleteExpenseTarget(null);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Gasto eliminado", "info");
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

  const income = calculateConfirmedIncome(payments);
  const pendingIncome = calculatePendingIncome(payments);
  const totalExpenses = calculateTotalExpenses(expenses);
  const netBalance = income - totalExpenses;
  const propNameById = new Map(properties.map((p) => [p.id, p.name]));

  return (
    <div>
      <PageHeader
        title="Finanzas"
        subtitle="Registra cobros y gastos por inmueble, verifica comprobantes y consulta tu balance neto."
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

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-muted">Ingresos confirmados</h2>
            <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-primary">${income.toLocaleString("es-CO")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-muted">Pagos por confirmar</h2>
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">${pendingIncome.toLocaleString("es-CO")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-muted">Gastos registrados</h2>
            <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700 dark:text-red-400">${totalExpenses.toLocaleString("es-CO")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-muted">Balance neto</h2>
            <TrendingUp className="h-4 w-4 text-primary-dark" aria-hidden="true" />
          </div>
          <p className={`mt-2 text-2xl font-bold ${netBalance >= 0 ? "text-primary-dark" : "text-red-700 dark:text-red-400"}`}>
            ${netBalance.toLocaleString("es-CO")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <h2 className="mb-3 font-semibold text-foreground">Registrar cobro / pago</h2>
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
              placeholder="Ej: Canon mensual"
              required
              error={errors.concept?.message}
              {...register("concept")}
            />
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <MoneyInput
                  label="Monto"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.amount?.message}
                />
              )}
            />
            <Button type="submit" loading={isSubmitting} disabled={!contracts.length}>
              Registrar cobro
            </Button>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <h2 className="mb-3 font-semibold text-foreground">Registrar gasto del inmueble</h2>
          <form onSubmit={handleExpSubmit(onAddExpense)} className="flex flex-col gap-3" noValidate>
            <Select
              label="Propiedad"
              error={expErrors.propertyId?.message}
              options={
                properties.length > 0
                  ? properties.map((p) => ({ value: p.id, label: p.name }))
                  : [{ value: "", label: "Sin propiedades disponibles" }]
              }
              {...registerExp("propertyId")}
            />
            <Input
              label="Tipo de gasto"
              placeholder="Ej: Mantenimiento, Predial, Administración"
              required
              error={expErrors.type?.message}
              {...registerExp("type")}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Controller
                control={expControl}
                name="amount"
                render={({ field }) => (
                  <MoneyInput
                    label="Valor"
                    value={field.value}
                    onChange={field.onChange}
                    error={expErrors.amount?.message}
                  />
                )}
              />
              <Input
                label="Período"
                placeholder="Ej: 2026-11"
                required
                error={expErrors.period?.message}
                {...registerExp("period")}
              />
            </div>
            <Button type="submit" variant="secondary" loading={savingExp} disabled={!properties.length}>
              Guardar gasto
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <h2 className="mb-3 font-semibold text-foreground">Historial de pagos</h2>
        {payments.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Sin pagos registrados"
            message="Cuando registres cobros o tu inquilino suba comprobantes aparecerán aquí."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {payments.map((p) => {
              const badge = getPaymentStatusBadge(p.status);
              return (
                <li
                  key={p.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-border p-3 text-sm sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {p.concept || "Pago"} — ${Number(p.amount).toLocaleString("es-CO")}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(p.date).toLocaleDateString("es-CO")}
                      {p.receipt_url && (
                        <button
                          type="button"
                          onClick={() => void openReceipt(p.receipt_url!)}
                          className="ml-2 font-medium text-primary hover:underline"
                        >
                          Ver comprobante
                        </button>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={badge.color}>{badge.label}</Badge>
                    {p.status !== "confirmado" && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => void handleConfirm(p.id)}>
                          Confirmar
                        </Button>
                        {p.status !== "rechazado" && (
                          <Button size="sm" variant="danger" onClick={() => setRejectTarget(p)}>
                            Rechazar
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <h2 className="mb-3 font-semibold text-foreground">Historial de gastos</h2>
        {expenses.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="Sin gastos registrados"
            message="Los egresos por mantenimiento, impuestos o administración aparecerán aquí."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {expenses.map((e) => (
              <li
                key={e.id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-border p-3 text-sm sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {e.type || "Gasto"} — ${Number(e.amount || 0).toLocaleString("es-CO")}
                  </p>
                  <p className="text-xs text-muted">
                    {propNameById.get(e.property_id || "") || "Inmueble"} · Período: {e.period || "N/A"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteExpenseTarget(e)}
                  className="self-start text-red-700 hover:bg-red-500/10 dark:text-red-400 sm:self-auto"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Eliminar</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <h2 className="mb-3 font-semibold text-foreground">Calculadora de arrendamiento</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Precio" inputMode="numeric" value={calcPrice} onChange={(e) => setCalcPrice(e.target.value.replace(/\D/g, ""))} />
          <Input label="Días" inputMode="numeric" value={calcDays} onChange={(e) => setCalcDays(e.target.value.replace(/\D/g, ""))} />
          <Input label="Descuento %" inputMode="numeric" value={calcDiscount} onChange={(e) => setCalcDiscount(e.target.value.replace(/\D/g, ""))} />
        </div>
        <p className="mt-3 text-lg font-bold text-primary">Total estimado: ${total.toLocaleString("es-CO")}</p>
      </div>

      <ConfirmModal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => void onConfirmReject()}
        title="Rechazar pago"
        message={`¿Seguro que deseas marcar como rechazado el pago "${rejectTarget?.concept || "Pago"}"?`}
        confirmLabel="Sí, rechazar"
        variant="danger"
        loading={busyAction}
      />

      <ConfirmModal
        open={Boolean(deleteExpenseTarget)}
        onClose={() => setDeleteExpenseTarget(null)}
        onConfirm={() => void onConfirmDeleteExpense()}
        title="Eliminar gasto"
        message={`¿Deseas eliminar el gasto "${deleteExpenseTarget?.type || "Gasto"}" del registro financiero?`}
        confirmLabel="Sí, eliminar"
        variant="danger"
        loading={busyAction}
      />
    </div>
  );
}
