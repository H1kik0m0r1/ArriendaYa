import { NextResponse } from "next/server";
import { enrichAuditLogs, requireAdminService } from "@/lib/admin/server-helpers";
import type { AdminOverviewData } from "@/modules/admin/types";

export async function GET() {
  const guard = await requireAdminService();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const [
    { data: profiles },
    { data: properties },
    { data: requests },
    { data: contracts },
    { data: visits },
    { data: reports },
    { data: verifications },
    { data: invitations },
    { data: auditRows },
  ] = await Promise.all([
    admin.from("profiles").select("*"),
    admin.from("properties").select("*"),
    admin.from("rental_requests").select("id, status"),
    admin.from("contracts").select("id, status"),
    admin.from("visits").select("id, status"),
    admin.from("reports").select("*").order("created_at", { ascending: false }).limit(200),
    admin.from("owner_verifications").select("user_id, status"),
    admin.from("owner_invitations").select("email, used_at"),
    admin.from("activity_log").select("*").order("created_at", { ascending: false }).limit(8),
  ]);

  const profList = (profiles as Array<Record<string, unknown>> | null) ?? [];
  const propList = (properties as Array<Record<string, unknown>> | null) ?? [];
  const reqList = (requests as Array<{ id: string; status: string }> | null) ?? [];
  const conList = (contracts as Array<{ id: string; status: string }> | null) ?? [];
  const visitList = (visits as Array<{ id: string; status: string }> | null) ?? [];
  const repList = (reports as Array<Record<string, unknown>> | null) ?? [];
  const verList = (verifications as Array<{ user_id: string; status: string }> | null) ?? [];
  const invList = (invitations as Array<{ email: string; used_at: string | null }> | null) ?? [];
  const rawAudit = (auditRows as Array<Record<string, unknown>> | null) ?? [];

  const migrationReady =
    (profList.length === 0 || "suspended_at" in profList[0]) &&
    (propList.length === 0 || "moderation_status" in propList[0]);

  const reqStatusMap: Record<string, number> = {};
  for (const r of reqList) {
    reqStatusMap[r.status] = (reqStatusMap[r.status] || 0) + 1;
  }

  const propStatusMap: Record<string, number> = {};
  for (const p of propList) {
    const st = String(p.status || "unknown");
    propStatusMap[st] = (propStatusMap[st] || 0) + 1;
  }

  const reporterIds = Array.from(
    new Set(repList.slice(0, 6).map((r) => r.reporter_id).filter((x): x is string => typeof x === "string"))
  );
  const reporterMap = new Map(
    profList
      .filter((p) => reporterIds.includes(String(p.id)))
      .map((p) => [String(p.id), { name: (p.full_name as string) || null, email: String(p.email || "") }])
  );
  const propNameMap = new Map(propList.map((p) => [String(p.id), String(p.name || "Inmueble")]));

  const recentAudit = await enrichAuditLogs(admin, rawAudit);

  const payload: AdminOverviewData = {
    migrationReady,
    stats: {
      usersTotal: profList.length,
      ownersCount: profList.filter((p) => p.role === "owner").length,
      tenantsCount: profList.filter((p) => p.role === "tenant").length,
      adminsCount: profList.filter((p) => p.role === "admin").length,
      suspendedUsersCount: profList.filter((p) => Boolean(p.suspended_at)).length,
      propertiesTotal: propList.length,
      publishedProperties: propList.filter(
        (p) => p.status === "published" && (!p.moderation_status || p.moderation_status === "active")
      ).length,
      rentedProperties: propList.filter((p) => p.status === "rented").length,
      pendingOrPausedProperties: propList.filter(
        (p) => p.status === "draft" || p.status === "paused" || p.status === "maintenance"
      ).length,
      moderatedProperties: propList.filter(
        (p) => typeof p.moderation_status === "string" && p.moderation_status !== "active"
      ).length,
      activeRequests: reqList.filter((r) =>
        ["pending", "first_accepted", "docs_submitted", "returned"].includes(r.status)
      ).length,
      activeContracts: conList.filter((c) => ["pending_signatures", "active", "expiring"].includes(c.status)).length,
      pendingVisits: visitList.filter((v) => v.status === "solicitada").length,
      pendingReports: repList.filter((r) => r.status === "pendiente" || r.status === "en_revision").length,
      pendingVerifications: verList.filter((v) => v.status === "pendiente" || v.status === "en_revision").length,
      pendingInvitations: invList.filter((i) => !i.used_at).length,
    },
    requestsByStatus: Object.entries(reqStatusMap).map(([name, value]) => ({ name, value })),
    propertiesByStatus: Object.entries(propStatusMap).map(([name, value]) => ({ name, value })),
    recentAudit,
    recentReports: repList.slice(0, 5).map((r) => {
      const repId = typeof r.reporter_id === "string" ? r.reporter_id : null;
      const tgtId = typeof r.target_id === "string" ? r.target_id : null;
      const reporter = repId ? reporterMap.get(repId) : undefined;
      return {
        id: String(r.id),
        reporter_id: repId,
        target_id: tgtId,
        target_type: typeof r.target_type === "string" ? r.target_type : null,
        reason: typeof r.reason === "string" ? r.reason : null,
        description: typeof r.description === "string" ? r.description : null,
        evidence_url: typeof r.evidence_url === "string" ? r.evidence_url : null,
        status: typeof r.status === "string" ? r.status : null,
        response: typeof r.response === "string" ? r.response : null,
        reviewed_by: typeof r.reviewed_by === "string" ? r.reviewed_by : null,
        updated_at: typeof r.updated_at === "string" ? r.updated_at : null,
        created_at: String(r.created_at || new Date().toISOString()),
        reporter_name: reporter?.name ?? null,
        reporter_email: reporter?.email ?? null,
        property_name: r.target_type === "property" && tgtId ? (propNameMap.get(tgtId) ?? null) : null,
      };
    }),
  };

  return NextResponse.json(payload);
}
