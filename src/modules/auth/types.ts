export type Role = "owner" | "tenant" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  avatar_url: string | null;
  accepted_terms: boolean;
  suspended_at?: string | null;
  suspended_reason?: string | null;
  suspended_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerInvitation {
  email: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
}
