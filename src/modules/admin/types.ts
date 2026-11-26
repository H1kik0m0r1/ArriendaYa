import type { OwnerInvitation, Role } from "@/modules/auth/types";
import type { PropertyModerationStatus, PropertyStatus } from "@/modules/properties/types";
import type { ReportItem } from "@/modules/reports/types";

export interface AdminOverviewData {
  migrationReady: boolean;
  stats: {
    usersTotal: number;
    ownersCount: number;
    tenantsCount: number;
    adminsCount: number;
    suspendedUsersCount: number;
    propertiesTotal: number;
    publishedProperties: number;
    rentedProperties: number;
    pendingOrPausedProperties: number;
    moderatedProperties: number;
    activeRequests: number;
    activeContracts: number;
    pendingVisits: number;
    pendingReports: number;
    pendingVerifications: number;
    pendingInvitations: number;
  };
  requestsByStatus: Array<{ name: string; value: number }>;
  propertiesByStatus: Array<{ name: string; value: number }>;
  recentAudit: AdminAuditItem[];
  recentReports: AdminReportItem[];
}

export interface AdminUserItem {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  suspended_by: string | null;
  verification_status: string | null;
  properties_count: number;
  contracts_count: number;
}

export interface AdminUsersResponse {
  migrationReady: boolean;
  users: AdminUserItem[];
  invitations: OwnerInvitation[];
}

export interface AdminPropertyItem {
  id: string;
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  name: string;
  type: string;
  location: string;
  price: number;
  price_period: string;
  status: PropertyStatus;
  moderation_status: PropertyModerationStatus;
  moderation_reason: string | null;
  moderated_at: string | null;
  moderated_by: string | null;
  created_at: string;
  updated_at: string;
  image_url: string | null;
  images_count: number;
  requests_count: number;
  contracts_count: number;
  active_contracts_count: number;
}

export interface AdminVerificationItem {
  user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  suspended_at: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  has_identity_doc: boolean;
  identity_doc_url: string | null;
  status: string;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string | null;
}

export interface AdminReportItem extends ReportItem {
  reporter_name?: string | null;
  reporter_email?: string | null;
  property_name?: string | null;
}

export interface AdminAuditItem {
  id: string;
  user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: Role | null;
  action: string;
  entity: string | null;
  target_type: string | null;
  target_id: string | null;
  result: "success" | "denied" | "error";
  details: Record<string, unknown>;
  created_at: string;
}
