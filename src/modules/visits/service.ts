import { isDemoMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";
import { apiJsonFetch, errResult, okResult, type ServiceResult } from "@/modules/shared/service-result";
import {
  insertCalendarEventRecord,
  insertPropertyVisit,
  listOwnerCalendarRecords,
  listTenantCalendarRecords,
  updateVisitStatusRecord,
} from "./repository";
import {
  calendarEventSchema,
  scheduleVisitSchema,
  type CalendarEventValues,
  type ScheduleVisitValues,
} from "./schemas";
import type { CalendarDisplayEvent, VisitRecord } from "./types";

interface LocalCalendarFallback {
  title: string;
  start: string;
  end: string;
}

export interface VisitWithProperty extends VisitRecord {
  propertyName: string;
}

function readLocalCalendarFallback(key: string): LocalCalendarFallback[] {
  if (!isDemoMode() || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as LocalCalendarFallback[]) : [];
  } catch {
    return [];
  }
}

export async function schedulePropertyVisit(
  propertyId: string,
  ownerId: string,
  values: ScheduleVisitValues
): Promise<ServiceResult<true>> {
  const parsed = scheduleVisitSchema.safeParse(values);
  if (!parsed.success) {
    return errResult(parsed.error.issues[0]?.message || "Datos de visita inválidos");
  }

  if (!isDemoMode()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errResult("UNAUTHENTICATED");
    if (user.id === ownerId) {
      return errResult("No puedes agendar una visita en tu propia propiedad.");
    }
    const res = await apiJsonFetch<{ visit?: VisitRecord }>("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        date: parsed.data.date,
      }),
    });
    if (!res.ok) {
      if (res.error === "No autenticado") return errResult("UNAUTHENTICATED");
      return res;
    }
    return okResult(true);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errResult("UNAUTHENTICATED");
  if (user.id === ownerId) {
    return errResult("No puedes agendar una visita en tu propia propiedad.");
  }

  const { error } = await insertPropertyVisit({
    property_id: propertyId,
    tenant_id: user.id,
    name: parsed.data.name,
    phone: parsed.data.phone,
    date: parsed.data.date,
  });

  if (error) return errResult(error.message);
  return okResult(true);
}

export async function loadOwnerCalendarData(): Promise<{
  events: CalendarDisplayEvent[];
  visits: VisitWithProperty[];
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const events: CalendarDisplayEvent[] = [];
  const visitsList: VisitWithProperty[] = [];

  if (user) {
    const { properties, contracts, visits, customEvents } = await listOwnerCalendarRecords(user.id);
    const propById = new Map(properties.map((p) => [p.id, p.name]));

    for (const c of contracts) {
      const propName = propById.get(c.property_id) || "Inmueble";
      if (c.start_date) {
        events.push({ title: `Inicio: ${propName}`, start: new Date(c.start_date), end: new Date(c.start_date), allDay: true });
      }
      if (c.end_date) {
        events.push({ title: `Fin: ${propName}`, start: new Date(c.end_date), end: new Date(c.end_date), allDay: true });
      }
    }

    for (const v of visits) {
      const propName = propById.get(v.property_id) || "Inmueble";
      visitsList.push({ ...v, propertyName: propName });
      if (!v.date) continue;
      events.push({
        title: `Visita (${v.status}): ${propName}`,
        start: new Date(v.date),
        end: new Date(v.date),
        allDay: true,
      });
    }

    for (const ce of customEvents) {
      if (!ce.title || !ce.start) continue;
      events.push({
        title: ce.title,
        start: new Date(ce.start),
        end: new Date(ce.end || ce.start),
        allDay: true,
      });
    }
  }

  for (const m of readLocalCalendarFallback("arriendaya_maintenance")) {
    events.push({ title: m.title, start: new Date(m.start), end: new Date(m.end), allDay: true });
  }

  return { events, visits: visitsList };
}

export async function loadOwnerCalendarEvents(): Promise<CalendarDisplayEvent[]> {
  const { events } = await loadOwnerCalendarData();
  return events;
}

export async function loadTenantCalendarData(): Promise<{
  events: CalendarDisplayEvent[];
  visits: VisitWithProperty[];
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const events: CalendarDisplayEvent[] = [];
  const visitsList: VisitWithProperty[] = [];

  if (user) {
    const { contracts, visits, customEvents } = await listTenantCalendarRecords(user.id);
    const propIds = Array.from(new Set(visits.map((v) => v.property_id).filter(Boolean)));
    const propNameMap = new Map<string, string>();
    if (propIds.length > 0) {
      const { data: props } = await supabase
        .from("properties")
        .select("id, name")
        .in("id", propIds);
      for (const p of (props as Array<{ id: string; name: string }> | null) ?? []) {
        propNameMap.set(p.id, p.name);
      }
    }

    for (const c of contracts) {
      if (c.start_date) {
        events.push({ title: "Inicio de contrato", start: new Date(c.start_date), end: new Date(c.start_date), allDay: true });
      }
      if (c.end_date) {
        events.push({ title: "Fin de contrato", start: new Date(c.end_date), end: new Date(c.end_date), allDay: true });
      }
    }

    for (const v of visits) {
      const propName = propNameMap.get(v.property_id) || "Inmueble";
      visitsList.push({ ...v, propertyName: propName });
      if (!v.date) continue;
      events.push({
        title: `Visita (${v.status}): ${propName}`,
        start: new Date(v.date),
        end: new Date(v.date),
        allDay: true,
      });
    }

    for (const ce of customEvents) {
      if (!ce.title || !ce.start) continue;
      events.push({
        title: ce.title,
        start: new Date(ce.start),
        end: new Date(ce.end || ce.start),
        allDay: true,
      });
    }
  }

  for (const e of readLocalCalendarFallback("arriendaya_tenant_events")) {
    events.push({ title: e.title, start: new Date(e.start), end: new Date(e.end), allDay: true });
  }

  return { events, visits: visitsList };
}

export async function loadTenantCalendarEvents(): Promise<CalendarDisplayEvent[]> {
  const { events } = await loadTenantCalendarData();
  return events;
}

export async function updateVisitStatus(
  visitId: string,
  status: "aprobada" | "cancelada"
): Promise<ServiceResult<VisitRecord>> {
  const { data, error } = await updateVisitStatusRecord(visitId, status);
  if (error || !data) {
    return errResult(error?.message || "No se pudo actualizar el estado de la visita");
  }
  return okResult(data as VisitRecord);
}

export async function createCalendarEvent(
  values: CalendarEventValues,
  eventType: "maintenance" | "personal"
): Promise<ServiceResult<CalendarDisplayEvent>> {
  const parsed = calendarEventSchema.safeParse(values);
  if (!parsed.success) {
    return errResult(parsed.error.issues[0]?.message || "Datos del evento inválidos");
  }

  if (!isDemoMode()) {
    const res = await apiJsonFetch("/api/calendar-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...parsed.data, type: eventType }),
    });
    if (!res.ok) return res;
    return okResult({
      title: parsed.data.title,
      start: new Date(`${parsed.data.start}T00:00:00-05:00`),
      end: new Date(`${parsed.data.end}T00:00:00-05:00`),
      allDay: true,
    });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errResult("No autenticado");

  const { error } = await insertCalendarEventRecord({
    user_id: user.id,
    type: eventType,
    title: parsed.data.title,
    start: new Date(`${parsed.data.start}T00:00:00-05:00`).toISOString(),
    end: new Date(`${parsed.data.end}T23:59:59-05:00`).toISOString(),
  });

  if (error) return errResult(error.message);

  return okResult({
    title: parsed.data.title,
    start: new Date(`${parsed.data.start}T00:00:00-05:00`),
    end: new Date(`${parsed.data.end}T00:00:00-05:00`),
    allDay: true,
  });
}
