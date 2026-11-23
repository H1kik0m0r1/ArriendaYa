"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales });

export default function TenantCalendarPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: cons } = await supabase.from("contracts").select("*").eq("tenant_id", user.id);
      const evs: any[] = [];
      for (const c of cons || []) {
        if (c.start_date) evs.push({ title: "Inicio de contrato", start: new Date(c.start_date), end: new Date(c.start_date), allDay: true });
        if (c.end_date) evs.push({ title: "Fin de contrato", start: new Date(c.end_date), end: new Date(c.end_date), allDay: true });
      }
      const personal = JSON.parse(localStorage.getItem("arriendaya_tenant_events") || "[]");
      for (const e of personal) evs.push({ title: e.title, start: new Date(e.start), end: new Date(e.end), allDay: true });
      setEvents(evs);
    })();
  }, [supabase]);

  const addEvent = () => {
    const title = prompt("Título del evento:");
    const start = prompt("Fecha inicio (YYYY-MM-DD):");
    const end = prompt("Fecha fin (YYYY-MM-DD):");
    if (!title || !start || !end) return;
    const personal = JSON.parse(localStorage.getItem("arriendaya_tenant_events") || "[]");
    personal.push({ title, start, end });
    localStorage.setItem("arriendaya_tenant_events", JSON.stringify(personal));
    setEvents((prev) => [...prev, { title, start: new Date(start), end: new Date(end), allDay: true }]);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Calendario y visitas</h1>
        <button onClick={addEvent} className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Agregar evento</button>
      </div>
      <div className="h-[600px] rounded-xl border border-border bg-card p-2">
        <Calendar localizer={localizer} events={events} startAccessor="start" endAccessor="end" culture="es" />
      </div>
    </div>
  );
}
