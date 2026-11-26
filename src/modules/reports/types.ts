export interface ReportItem {
  id: string;
  reporter_id: string | null;
  target_id: string | null;
  target_type: string | null;
  reason: string | null;
  description: string | null;
  evidence_url: string | null;
  status: string | null;
  response: string | null;
  reviewed_by?: string | null;
  updated_at?: string | null;
  created_at: string;
}
