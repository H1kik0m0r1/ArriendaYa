import { NextResponse } from "next/server";
import { enrichAuditLogs, requireAdminService } from "@/lib/admin/server-helpers";

function csvCell(value: unknown): string {
  const str = String(value ?? "");
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(request: Request) {
  const guard = await requireAdminService();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const resultFilter = (searchParams.get("result") || "").trim();
  const targetTypeFilter = (searchParams.get("targetType") || "").trim();
  const format = (searchParams.get("format") || "").trim().toLowerCase();
  const pageRaw = Number(searchParams.get("page") || "1");
  const pageSizeRaw = Number(searchParams.get("pageSize") || "25");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(Math.floor(pageSizeRaw), 10), 100)
    : 25;

  const { data: rawLogs, error } = await admin
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (rawLogs as Array<Record<string, unknown>> | null) ?? [];
  const migrationReady = rows.length === 0 || "target_type" in rows[0];
  let logs = await enrichAuditLogs(admin, rows);

  if (resultFilter && ["success", "denied", "error"].includes(resultFilter)) {
    logs = logs.filter((l) => l.result === resultFilter);
  }
  if (targetTypeFilter) {
    logs = logs.filter((l) => l.target_type === targetTypeFilter);
  }
  if (q) {
    logs = logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        (l.entity || "").toLowerCase().includes(q) ||
        (l.target_id || "").toLowerCase().includes(q) ||
        (l.actor_email || "").toLowerCase().includes(q) ||
        (l.actor_name || "").toLowerCase().includes(q)
    );
  }

  if (format === "csv") {
    const header = [
      "id",
      "created_at",
      "action",
      "result",
      "target_type",
      "target_id",
      "entity",
      "actor_name",
      "actor_email",
      "actor_role",
    ].join(",");
    const lines = logs.map((l) =>
      [
        l.id,
        l.created_at,
        l.action,
        l.result,
        l.target_type ?? "",
        l.target_id ?? "",
        l.entity ?? "",
        l.actor_name ?? "",
        l.actor_email ?? "",
        l.actor_role ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
    const csvContent = `\uFEFF${[header, ...lines].join("\r\n")}`;
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="auditoria-arriendaya.csv"',
      },
    });
  }

  const total = logs.length;
  const start = (page - 1) * pageSize;
  const pagedLogs = logs.slice(start, start + pageSize);

  return NextResponse.json({
    migrationReady,
    logs: pagedLogs,
    total,
    page,
    pageSize,
  });
}
