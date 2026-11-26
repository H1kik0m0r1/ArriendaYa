import { NextResponse } from "next/server";
import { requireAdminService } from "@/lib/admin/server-helpers";
import type { AdminUserItem } from "@/modules/admin/types";
import type { OwnerInvitation, Role } from "@/modules/auth/types";

export async function GET(request: Request) {
  const guard = await requireAdminService();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const roleFilter = (searchParams.get("role") || "").trim();
  const statusFilter = (searchParams.get("status") || "").trim();

  const [
    { data: rawProfiles, error: profErr },
    { data: rawVerifications },
    { data: rawInvitations },
    { data: rawProps },
    { data: rawContracts },
  ] = await Promise.all([
    admin.from("profiles").select("*").order("created_at", { ascending: false }),
    admin.from("owner_verifications").select("user_id, status"),
    admin.from("owner_invitations").select("*").order("created_at", { ascending: false }),
    admin.from("properties").select("id, owner_id"),
    admin.from("contracts").select("id, owner_id, tenant_id"),
  ]);

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 400 });
  }

  const profList = (rawProfiles as Array<Record<string, unknown>> | null) ?? [];
  const migrationReady = profList.length === 0 || "suspended_at" in profList[0];

  const verMap = new Map(
    ((rawVerifications as Array<{ user_id: string; status: string }> | null) ?? []).map((v) => [
      v.user_id,
      v.status,
    ])
  );

  const propCountByOwner = new Map<string, number>();
  for (const p of (rawProps as Array<{ id: string; owner_id: string }> | null) ?? []) {
    propCountByOwner.set(p.owner_id, (propCountByOwner.get(p.owner_id) || 0) + 1);
  }

  const contractCountByUser = new Map<string, number>();
  for (const c of (rawContracts as Array<{ id: string; owner_id: string; tenant_id: string }> | null) ?? []) {
    contractCountByUser.set(c.owner_id, (contractCountByUser.get(c.owner_id) || 0) + 1);
    contractCountByUser.set(c.tenant_id, (contractCountByUser.get(c.tenant_id) || 0) + 1);
  }

  let users: AdminUserItem[] = profList.map((row) => {
    const id = String(row.id);
    const role = row.role as Role;
    const suspendedAt = typeof row.suspended_at === "string" ? row.suspended_at : null;
    return {
      id,
      email: String(row.email || ""),
      full_name: typeof row.full_name === "string" ? row.full_name : null,
      phone: typeof row.phone === "string" ? row.phone : null,
      role,
      created_at: String(row.created_at || new Date().toISOString()),
      updated_at: String(row.updated_at || row.created_at || new Date().toISOString()),
      suspended_at: suspendedAt,
      suspended_reason: typeof row.suspended_reason === "string" ? row.suspended_reason : null,
      suspended_by: typeof row.suspended_by === "string" ? row.suspended_by : null,
      verification_status: role === "owner" ? (verMap.get(id) ?? "pendiente") : null,
      properties_count: propCountByOwner.get(id) || 0,
      contracts_count: contractCountByUser.get(id) || 0,
    };
  });

  if (roleFilter && ["admin", "owner", "tenant"].includes(roleFilter)) {
    users = users.filter((u) => u.role === roleFilter);
  }
  if (statusFilter === "suspended") {
    users = users.filter((u) => Boolean(u.suspended_at));
  } else if (statusFilter === "active") {
    users = users.filter((u) => !u.suspended_at);
  }
  if (q) {
    users = users.filter(
      (u) =>
        u.id.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    migrationReady,
    users,
    invitations: (rawInvitations as OwnerInvitation[] | null) ?? [],
  });
}
