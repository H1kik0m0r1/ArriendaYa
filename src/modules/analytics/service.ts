import { createClient } from "@/lib/supabase/client";
import { getOwnerRawAnalyticsRecords, getTenantRawDashboardRecords } from "./repository";
import type { OwnerDashboardData, OwnerStatsData, TenantDashboardData } from "./types";

const THIRTY_DAYS_MS = 30 * 86400000;

export async function fetchOwnerDashboardData(): Promise<OwnerDashboardData | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { properties, requests, contracts, notifications } = await getOwnerRawAnalyticsRecords(user.id);

  const published = properties.filter((p) => p.status === "published").length;
  const rented = properties.filter((p) => p.status === "rented").length;
  const available = properties.filter((p) => p.status === "published" || p.status === "draft").length;
  const pending = requests.filter((r) => r.status === "pending" || r.status === "docs_submitted").length;
  const activeContracts = contracts.filter((c) => c.status === "active").length;
  const nowMs = Date.now();
  const soon = contracts.filter(
    (c) => c.status === "active" && c.end_date && new Date(c.end_date).getTime() - nowMs <= THIRTY_DAYS_MS
  ).length;

  const byStatus: Record<string, number> = {};
  for (const r of requests) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

  return {
    stats: {
      published,
      rented,
      available,
      received: requests.length,
      pending,
      activeContracts,
      soon,
    },
    chartData: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
    activity: notifications.slice(0, 10),
  };
}

export async function fetchOwnerStatsData(): Promise<OwnerStatsData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { visits: [], requests: [], conversion: [] };
  }

  const { properties, requests, viewsByProperty, visitRequestsByProperty } = await getOwnerRawAnalyticsRecords(user.id);
  const byProp: Record<string, number> = {};
  for (const r of requests) {
    byProp[r.property_id] = (byProp[r.property_id] || 0) + 1;
  }

  const total = requests.length;
  const accepted = requests.filter((r) => r.status === "accepted").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;

  return {
    visits: properties.map((p) => ({
      name: p.name,
      visitas: Math.max(p.visits || 0, viewsByProperty[p.id] || 0, visitRequestsByProperty[p.id] || 0),
      guardados: visitRequestsByProperty[p.id] || 0,
    })),
    requests: properties.map((p) => ({ name: p.name, solicitudes: byProp[p.id] || 0 })),
    conversion: [
      { name: "Aceptadas", value: accepted },
      { name: "Rechazadas", value: rejected },
      { name: "Otras", value: total - accepted - rejected },
    ],
  };
}

export async function fetchTenantDashboardData(): Promise<TenantDashboardData | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { requests, contracts, notifications } = await getTenantRawDashboardRecords(user.id);

  const pending = requests.filter((r) => r.status === "pending").length;
  const inReview = requests.filter((r) => r.status === "docs_submitted" || r.status === "returned").length;
  const docsPending = requests.filter((r) => r.status === "first_accepted" || r.status === "returned").length;
  const active = contracts.filter((c) => c.status === "active").length;
  const nowMs = Date.now();
  const soon = contracts.filter(
    (c) => c.status === "active" && c.end_date && new Date(c.end_date).getTime() - nowMs <= THIRTY_DAYS_MS
  ).length;

  return {
    stats: {
      total: requests.length,
      pending,
      inReview,
      active,
      soon,
      docsPending,
    },
    activity: notifications.slice(0, 10),
  };
}
