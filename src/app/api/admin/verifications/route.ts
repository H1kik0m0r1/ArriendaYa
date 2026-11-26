import { NextResponse } from "next/server";
import { requireAdminService } from "@/lib/admin/server-helpers";
import type { AdminVerificationItem } from "@/modules/admin/types";

export async function GET() {
  const guard = await requireAdminService();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  const [{ data: owners, error: ownersErr }, { data: verifications }] = await Promise.all([
    admin
      .from("profiles")
      .select("*")
      .eq("role", "owner")
      .order("created_at", { ascending: false }),
    admin.from("owner_verifications").select("*"),
  ]);

  if (ownersErr) {
    return NextResponse.json({ error: ownersErr.message }, { status: 400 });
  }

  const verRows = (verifications as Array<Record<string, unknown>> | null) ?? [];
  const migrationReady = verRows.length === 0 || "reviewed_by" in verRows[0];
  const verMap = new Map(verRows.map((v) => [String(v.user_id), v]));

  const items: AdminVerificationItem[] = ((owners as Array<Record<string, unknown>> | null) ?? []).map(
    (owner) => {
      const userId = String(owner.id);
      const ver = verMap.get(userId);
      const rawDoc = typeof ver?.identity_doc_url === "string" ? ver.identity_doc_url : null;
      return {
        user_id: userId,
        full_name: typeof owner.full_name === "string" ? owner.full_name : null,
        email: String(owner.email || ""),
        phone: typeof owner.phone === "string" ? owner.phone : null,
        suspended_at: typeof owner.suspended_at === "string" ? owner.suspended_at : null,
        email_verified: Boolean(ver?.email_verified),
        phone_verified: Boolean(ver?.phone_verified),
        has_identity_doc: Boolean(rawDoc),
        identity_doc_url: rawDoc,
        status: typeof ver?.status === "string" ? ver.status : "pendiente",
        notes: typeof ver?.notes === "string" ? ver.notes : null,
        reviewed_by: typeof ver?.reviewed_by === "string" ? ver.reviewed_by : null,
        reviewed_at: typeof ver?.reviewed_at === "string" ? ver.reviewed_at : null,
        updated_at: typeof ver?.updated_at === "string" ? ver.updated_at : null,
      };
    }
  );

  return NextResponse.json({ migrationReady, verifications: items });
}
