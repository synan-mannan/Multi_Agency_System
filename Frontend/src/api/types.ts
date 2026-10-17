export type ApiRole = 'agency_admin' | 'agency_member' | 'client_user';
export type ApiVisibility = 'internal' | 'client_visible';

export interface WorkspaceChoice {
  membership_id: string;
  agency_id: string;
  agency_name: string;
  role: ApiRole;
  client_id: string | null;
}

export interface LoginResponse {
  identity_token: string;
  workspaces: WorkspaceChoice[];
}

export interface SelectWorkspaceResponse {
  access_token: string;
  token_type: 'bearer';
}

export interface MeResponse {
  user_id: string;
  membership_id: string;
  agency_id: string;
  agency_name: string;
  role: ApiRole;
  client_id: string | null;
  email: string;
  full_name: string;
}

export interface ApiProject {
  id: string;
  agency_id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at?: string;
  client_name?: string;
}

export interface ApiTask {
  id: string;
  agency_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  visibility: ApiVisibility;
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  comment_count?: number;
  file_count?: number;
}

export interface ApiComment {
  id: string;
  agency_id: string;
  task_id: string;
  author_id: string;
  body: string;
  visibility: ApiVisibility;
  created_at: string;
  parent_id?: string | null;
}

export interface ApiFile {
  id: string;
  agency_id?: string;
  task_id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  visibility: ApiVisibility;
  review_status: 'pending' | 'approved' | 'changes_requested';
  review_note: string | null;
  uploaded_by?: string;
  created_at: string;
}

export interface ApiTimeEntry {
  id: string;
  agency_id: string;
  task_id: string;
  membership_id: string;
  minutes: number;
  entry_date: string;
  note: string | null;
}

export interface ApiTimeWithProject extends ApiTimeEntry {
  project_id: string;
}

export interface ApiTeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: ApiRole;
  client_id: string | null;
  status: 'active' | 'removed';
  removed_at: string | null;
}

export interface ApiProjectMember {
  membership_id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: ApiRole;
}

export interface ApiClient {
  id: string;
  agency_id: string;
  org_name: string;
  contact_name?: string | null;
  contact_email?: string | null;
}

export interface ApiInvite {
  id: string;
  agency_id: string;
  email: string;
  role: ApiRole;
  client_id: string | null;
  status: 'pending' | 'accepted' | 'revoked';
  created_at: string;
  expires_at?: string;
}

export interface ApiProjectDashboard {
  task_counts: Record<'todo' | 'in_progress' | 'in_review' | 'done', number>;
  total_hours: number;
}

export interface ApiProjectHours {
  members: Array<{ membership_id: string; full_name: string; hours: number }>;
  total_hours: number;
}

export interface ApiActivity {
  id: string;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_name?: string | null;
}
