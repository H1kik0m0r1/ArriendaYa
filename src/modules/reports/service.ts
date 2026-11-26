import { isDemoMode } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/client";
import { apiJsonFetch, errResult, okResult, type ServiceResult } from "@/modules/shared/service-result";
import { insertDemoReport, listReports as listDemoReports, updateReportResponse } from "./repository";
import { reportCreateSchema, reportResponseSchema, type ReportCreateValues } from "./schemas";
import type { ReportItem } from "./types";

export async function fetchScopedReports(): Promise<ServiceResult<ReportItem[]>> {
  if (isDemoMode()) {
    return okResult(await listDemoReports());
  }
  const res = await apiJsonFetch<{ reports?: ReportItem[] }>("/api/reports");
  if (!res.ok) return res;
  return okResult(res.data.reports || []);
}

export async function createReport(values: ReportCreateValues): Promise<ServiceResult<ReportItem>> {
  const parsed = reportCreateSchema.safeParse(values);
  if (!parsed.success) {
    return errResult(parsed.error.issues[0]?.message || "Datos inválidos");
  }

  if (isDemoMode()) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return errResult("No autenticado");

    const propertyId = parsed.data.propertyId?.trim() || null;
    const { data, error } = await insertDemoReport({
      reporter_id: user.id,
      target_id: propertyId,
      target_type: propertyId ? "property" : "plataforma",
      reason: parsed.data.reason,
      description: parsed.data.description,
    });
    if (error || !data) return errResult(error?.message || "No se pudo crear el reporte");
    return okResult(data as ReportItem);
  }

  const res = await apiJsonFetch<{ report?: ReportItem }>("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return res;
  if (!res.data.report) return errResult("No se recibió el reporte creado");
  return okResult(res.data.report);
}

export async function replyToReport(
  reportId: string,
  response: string
): Promise<ServiceResult<true>> {
  const parsed = reportResponseSchema.safeParse({ response });
  if (!parsed.success) {
    return errResult(parsed.error.issues[0]?.message || "Respuesta inválida");
  }

  if (isDemoMode()) {
    const { error } = await updateReportResponse(reportId, parsed.data.response);
    if (error) return errResult(error.message);
    return okResult(true);
  }

  const res = await apiJsonFetch(`/api/reports/${reportId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: parsed.data.response }),
  });
  if (!res.ok) return res;
  return okResult(true);
}
