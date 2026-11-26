import { createClient } from "@/lib/supabase/client";
import type { ReportItem } from "./types";

export async function listReports(): Promise<ReportItem[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as ReportItem[] | null) ?? [];
}

export async function insertDemoReport(payload: {
  reporter_id: string;
  target_id: string | null;
  target_type: string;
  reason: string;
  description: string;
}) {
  const supabase = createClient();
  return supabase
    .from("reports")
    .insert({ ...payload, status: "pendiente" })
    .select("*")
    .single();
}

export async function updateReportResponse(reportId: string, response: string) {
  const supabase = createClient();
  return supabase
    .from("reports")
    .update({ response, status: "respondido" })
    .eq("id", reportId);
}
