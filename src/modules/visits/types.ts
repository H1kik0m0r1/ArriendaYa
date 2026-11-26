export type VisitStatus =
  | "solicitada"
  | "aprobada"
  | "rechazada"
  | "reprogramada"
  | "completada"
  | "cancelada"
  | string;

export interface VisitRecord {
  id: string;
  property_id: string;
  tenant_id: string | null;
  name: string | null;
  phone: string | null;
  date: string | null;
  papers?: string | null;
  status: VisitStatus;
  created_at: string;
}

export interface CalendarEventRecord {
  id: string;
  property_id: string | null;
  user_id: string | null;
  type: string | null;
  title: string | null;
  start: string | null;
  end: string | null;
  notes?: string | null;
  created_at: string;
}

export interface CalendarDisplayEvent {
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
}
