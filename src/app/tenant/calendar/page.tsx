"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon, Plus, X } from "lucide-react";
import { getBogotaTodayIso } from "@/lib/date/bogota";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { getVisitStatusBadge } from "@/modules/shared/status-badges";
import { calendarEventSchema, type CalendarEventValues } from "@/modules/visits/schemas";
import {
  createCalendarEvent,
  loadTenantCalendarData,
  updateVisitStatus,
  type VisitWithProperty,
} from "@/modules/visits/service";
import type { CalendarDisplayEvent } from "@/modules/visits/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
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

export default function TenantCalendarPage() {
  const [events, setEvents] = useState<CalendarDisplayEvent[]>([]);
  const [visits, setVisits] = useState<VisitWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<VisitWithProperty | null>(null);
  const [canceling, setCanceling] = useState(false);
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
      const data = await loadTenantCalendarData();
      setEvents(data.events);
      setVisits(data.visits);
    } catch {
      setLoadError("No se pudieron cargar tus visitas y recordatorios.");
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
    const res = await createCalendarEvent(values, "personal");
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    setEvents((prev) => [...prev, res.data]);
    setShowModal(false);
    reset({ title: "", start: "", end: "" });
    toast.show("Evento guardado en tu calendario", "success");
  };

  const confirmCancelVisit = async () => {
    if (!cancelTarget) return;
    setCanceling(true);
    const res = await updateVisitStatus(cancelTarget.id, "cancelada");
    setCanceling(false);
    setCancelTarget(null);
    if (!res.ok) {
      toast.show(res.error, "error");
      return;
    }
    toast.show("Visita cancelada", "info");
    await refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario y visitas"
        subtitle="Consulta tus visitas programadas, fechas de contrato y recordatorios personales."
        actions={
          <Button type="button" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Agregar evento</span>
          </Button>
        }
      />

      <Card>
        <CardBody className="p-3 sm:p-4">
          <div className="h-[520px] sm:h-[600px]">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              culture="es"
              messages={{
                today: "Hoy",
                previous: "Anterior",
                next: "Siguiente",
                month: "Mes",
                week: "Semana",
                day: "Día",
                agenda: "Agenda",
                noEventsInRange: "Sin eventos en este rango.",
              }}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold text-primary-dark">Mis visitas agendadas</h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Cargando visitas agendadas">
              {[1, 2].map((item) => (
                <div key={item} className="flex items-center justify-between gap-3 py-2 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-4 w-48 rounded bg-border/70" />
                    <div className="h-3 w-40 rounded bg-border/50" />
                  </div>
                  <div className="h-8 w-28 rounded-lg bg-border/60" />
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
              title="Sin visitas agendadas"
              message="Cuando programes una visita desde un inmueble aparecerá aquí."
            />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {visits.map((v) => {
                const badge = getVisitStatusBadge(v.status);
                const isCanceled = v.status === "cancelada" || v.status === "rechazada";
                return (
                  <li
                    key={v.id}
                    className="flex flex-col justify-between gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{v.propertyName}</p>
                        <Badge color={badge.color}>{badge.label}</Badge>
                      </div>
                      {v.date && (
                        <p className="text-xs text-muted">
                          Fecha solicitada: {new Date(v.date).toLocaleDateString("es-CO")}
                        </p>
                      )}
                    </div>
                    {!isCanceled && (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => setCancelTarget(v)}
                        className="self-start sm:self-auto"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Cancelar visita</span>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Agregar evento">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <Input label="Título" placeholder="Ej. Visita apartamento norte" error={errors.title?.message} {...register("title")} />
          <Input label="Fecha inicio" type="date" min={getBogotaTodayIso()} error={errors.start?.message} {...register("start")} />
          <Input label="Fecha fin" type="date" min={getBogotaTodayIso()} error={errors.end?.message} {...register("end")} />
          <Button type="submit" loading={isSubmitting}>Guardar evento</Button>
        </form>
      </Modal>

      <ConfirmModal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => void confirmCancelVisit()}
        title="Cancelar visita"
        message={`¿Deseas cancelar la visita programada para "${cancelTarget?.propertyName || "este inmueble"}"?`}
        confirmLabel="Sí, cancelar visita"
        cancelLabel="Volver"
        variant="danger"
        loading={canceling}
      />
    </div>
  );
}
