import type { Notification } from "@/modules/notifications/types";

export interface ChartDatum {
  name: string;
  value: number;
}

export interface OwnerDashboardStats {
  published: number;
  rented: number;
  available: number;
  received: number;
  pending: number;
  activeContracts: number;
  soon: number;
}

export interface OwnerDashboardData {
  stats: OwnerDashboardStats;
  chartData: ChartDatum[];
  activity: Notification[];
}

export interface PropertyVisitsDatum {
  name: string;
  visitas: number;
  guardados: number;
}

export interface PropertyRequestsDatum {
  name: string;
  solicitudes: number;
}

export interface OwnerStatsData {
  visits: PropertyVisitsDatum[];
  requests: PropertyRequestsDatum[];
  conversion: ChartDatum[];
}

export interface TenantDashboardStats {
  total: number;
  pending: number;
  inReview: number;
  active: number;
  soon: number;
  docsPending: number;
}

export interface TenantDashboardData {
  stats: TenantDashboardStats;
  activity: Notification[];
}
