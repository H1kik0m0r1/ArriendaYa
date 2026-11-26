import { apiJsonFetch, type ServiceResult } from "@/modules/shared/service-result";
import type {
  AdminReportUpdateValues,
  OwnerVerificationReviewValues,
  PropertyModerationValues,
  UserStatusActionValues,
} from "./schemas";
import type {
  AdminAuditItem,
  AdminOverviewData,
  AdminPropertyItem,
  AdminReportItem,
  AdminUsersResponse,
  AdminVerificationItem,
} from "./types";

export function fetchAdminOverview(): Promise<ServiceResult<AdminOverviewData>> {
  return apiJsonFetch<AdminOverviewData>("/api/admin/overview");
}

export function fetchAdminUsers(params?: {
  q?: string;
  role?: string;
  status?: string;
}): Promise<ServiceResult<AdminUsersResponse>> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.role) qs.set("role", params.role);
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString();
  return apiJsonFetch<AdminUsersResponse>(`/api/admin/users${query ? `?${query}` : ""}`);
}

export function updateAdminUserStatus(
  userId: string,
  payload: UserStatusActionValues
): Promise<ServiceResult<{ ok: true; suspended_at: string | null }>> {
  return apiJsonFetch(`/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchAdminProperties(params?: {
  q?: string;
  status?: string;
  moderation?: string;
}): Promise<ServiceResult<{ migrationReady: boolean; properties: AdminPropertyItem[] }>> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.status) qs.set("status", params.status);
  if (params?.moderation) qs.set("moderation", params.moderation);
  const query = qs.toString();
  return apiJsonFetch(`/api/admin/properties${query ? `?${query}` : ""}`);
}

export function moderateAdminProperty(
  propertyId: string,
  payload: PropertyModerationValues
): Promise<ServiceResult<{ ok: true; moderation_status: string }>> {
  return apiJsonFetch(`/api/admin/properties/${propertyId}/moderate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchAdminVerifications(): Promise<
  ServiceResult<{ migrationReady: boolean; verifications: AdminVerificationItem[] }>
> {
  return apiJsonFetch("/api/admin/verifications");
}

export function updateAdminVerification(
  userId: string,
  payload: OwnerVerificationReviewValues
): Promise<ServiceResult<{ ok: true }>> {
  return apiJsonFetch(`/api/admin/verifications/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchAdminReports(): Promise<ServiceResult<{ reports: AdminReportItem[] }>> {
  return apiJsonFetch<{ reports: AdminReportItem[] }>("/api/reports");
}

export function updateAdminReport(
  reportId: string,
  payload: AdminReportUpdateValues
): Promise<ServiceResult<{ ok: true }>> {
  return apiJsonFetch(`/api/reports/${reportId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchAdminAudit(params?: {
  q?: string;
  result?: string;
  targetType?: string;
  page?: number;
  pageSize?: number;
}): Promise<
  ServiceResult<{
    migrationReady: boolean;
    logs: AdminAuditItem[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.result) qs.set("result", params.result);
  if (params?.targetType) qs.set("targetType", params.targetType);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const query = qs.toString();
  return apiJsonFetch(`/api/admin/audit${query ? `?${query}` : ""}`);
}
