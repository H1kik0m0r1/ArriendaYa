"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { Modal } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { es };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales });

export default function CalendarPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: props } = await supabase.from("properties").select("id,name").eq("owner_id", user.id);
      const ids = (props || []).map((p: any) => p.id);
      if (!ids.length) return;
      const { data: cons } = await supabase.from("contracts").select("*").in("property_id", ids);
      const evs: any[] = [];
      for (const c of cons || []) {
        const p = props.find((x: any) => x.id === c.property_id);
        if (c.start_date) evs.push({ title: `Inicio: ${p?.name}`, start: new Date(c.start_date), end: new Date(c.start_date), allDay: true });
        if (c.end_date) evs.push({ title: `Fin: ${p?.name}`, start: new Date(c.end_date), end: new Date(c.end_date), allDay: true });
      }
      // maintenance events from localStorage
      const maint = JSON.parse(localStorage.getItem("arriendaya_maintenance") || "[]");
      for (const m of maint) evs.push({ title: m.title, start: new Date(m.start), end: new Date(m.end), allDay: true });
      setEvents(evs);
    })();
  }, [supabase]);

  const [showModal, setShowModal] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evStart, setEvStart] = useState("");
  const [evEnd, setEvEnd] = useState("");

  const addMaintenance = () => {
    if (!evTitle || !evStart || !evEnd) return;
    const maint = JSON.parse(localStorage.getItem("arriendaya_maintenance") || "[]");
    maint.push({ title: evTitle, start: evStart, end: evEnd });
    localStorage.setItem("arriendaya_maintenance", JSON.stringify(maint));
    setEvents((prev) => [...prev, { title: evTitle, start: new Date(evStart), end: new Date(evEnd), allDay: true }]);
    setShowModal(false);
    setEvTitle(""); setEvStart(""); setEvEnd("");
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Calendario</h1>
        <button onClick={() => setShowModal(true)} className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Agregar evento</button>
      </div>
      <div className="h-[600px] rounded-xl border border-border bg-card p-2">
        <Calendar localizer={localizer} events={events} startAccessor="start" endAccessor="end" culture="es" />
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Agregar evento">
        <div className="flex flex-col gap-3">
          <Input label="Título" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
          <Input label="Fecha inicio" type="date" value={evStart} onChange={(e) => setEvStart(e.target.value)} />
          <Input label="Fecha fin" type="date" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} />
          <Button onClick={addMaintenance}>Guardar</Button>
        </div>
      </Modal>
    </div>
  );
}
