"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon, Check, Plus, X } from "lucide-react";
import { getBogotaTodayIso } from "@/lib/date/bogota";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { getVisitStatusBadge } from "@/modules/shared/status-badges";
import { calendarEventSchema, type CalendarEventValues } from "@/modules/visits/schemas";
import {
  createCalendarEvent,
  loadOwnerCalendarData,
  updateVisitStatus,
  type VisitWithProperty,
} from "@/modules/visits/service";
import type { CalendarDisplayEvent } from "@/modules/visits/types";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";

const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarDisplayEvent[]>([]);
  const [visits, setVisits] = useState<VisitWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [updatingVisitId, setUpdatingVisitId] = useState<string | null>(null);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CalendarEventValues>({
    resolver: zodResolver(calendarEventSchema),
    mode: "onTouched",
    defaultValues: { title: "", start: "", end: "" },
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await loadOwnerCalendarData();
      setEvents(data.events);
      setVisits(data.visits);
    } catch {
      setLoadError("No se pudieron cargar tus visitas y eventos programados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const onSubmit = async (values: CalendarEventValues) => {
    const res = await createCalendarEvent(values, "maintenance");
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setEvents((prev) => [...prev, res.data]);
    setShowModal(false);
    reset({ title: "", start: "", end: "" });
    toast.show("Evento agregado al calendario", "success");
  };

  const handleVisitAction = async (visitId: string, status: "aprobada" | "cancelada") => {
    setUpdatingVisitId(visitId);
    const res = await updateVisitStatus(visitId, status);
    setUpdatingVisitId(null);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show(status === "aprobada" ? "Visita confirmada" : "Visita cancelada", "info");
    await refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario y visitas"
        subtitle="Visualiza contratos, mantenimientos y confirma o cancela las visitas solicitadas."
        actions={
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Agregar evento
          </Button>
        }
      />

      <div className="min-h-[480px] overflow-x-auto rounded-2xl border border-border bg-card p-3 shadow-xs md:h-[600px]">
        <div className="h-[460px] min-w-[320px] md:h-full">
          <Calendar localizer={localizer} events={events} startAccessor="start" endAccessor="end" culture="es" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <h2 className="mb-3 font-semibold text-foreground">Visitas programadas</h2>
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando visitas programadas">
            {[1, 2].map((item) => (
              <div key={item} className="flex items-center justify-between gap-3 py-2 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 w-48 rounded bg-border/70" />
                  <div className="h-3 w-64 rounded bg-border/50" />
                </div>
                <div className="h-8 w-24 rounded-lg bg-border/60" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <Alert variant="error" title="Error al cargar visitas">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{loadError}</span>
              <Button type="button" size="sm" variant="secondary" onClick={() => void refresh()}>
                Reintentar
              </Button>
            </div>
          </Alert>
        ) : visits.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6" />}
            title="Sin visitas agendadas"
            message="Las solicitudes de visita que envíen los interesados aparecerán aquí."
          />
        ) : (
          <ul className="divide-y divide-border text-sm">
            {visits.map((v) => {
              const badge = getVisitStatusBadge(v.status);
              const isCanceled = v.status === "cancelada" || v.status === "rechazada";
              return (
                <li
                  key={v.id}
                  className="flex flex-col justify-between gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{v.propertyName}</p>
                      <Badge color={badge.color}>{badge.label}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      Solicitante: {v.name || "Interesado"} {v.phone ? `· Tel: ${v.phone}` : ""}
                      {v.date ? ` · Fecha: ${new Date(v.date).toLocaleDateString("es-CO")}` : ""}
                    </p>
                  </div>
                  {!isCanceled && (
                    <div className="flex flex-wrap gap-2">
                      {v.status !== "aprobada" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          loading={updatingVisitId === v.id}
                          onClick={() => void handleVisitAction(v.id, "aprobada")}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Confirmar</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        loading={updatingVisitId === v.id}
                        onClick={() => void handleVisitAction(v.id, "cancelada")}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Cancelar</span>
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Agregar evento" className="max-w-md">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div className="flex items-center gap-2 text-xs text-muted">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Registra mantenimientos o recordatorios de tus inmuebles.
          </div>
          <Input label="Título" required error={errors.title?.message} {...register("title")} />
          <Input label="Fecha inicio" type="date" min={getBogotaTodayIso()} required error={errors.start?.message} {...register("start")} />
          <Input label="Fecha fin" type="date" min={getBogotaTodayIso()} required error={errors.end?.message} {...register("end")} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
