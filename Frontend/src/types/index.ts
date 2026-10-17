// ─── Core Domain Types ────────────────────────────────────────────────────────

export type WorkspaceId = string;
export type UserId = string;
export type ProjectId = string;
export type TaskId = string;
export type CommentId = string;
export type FileId = string;
export type TimeEntryId = string;
export type ClientOrgId = string;
export type InviteId = string;

export type Role = 'admin' | 'member' | 'client';
export type Persona = 'admin' | 'member' | 'client';
export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';
export type FileReviewStatus = 'pending' | 'approved' | 'changes_requested';
export type Visibility = 'internal' | 'client';
export type InviteStatus = 'pending' | 'accepted' | 'revoked';
export type MemberStatus = 'active' | 'removed';

// ─── Workspace / Agency ───────────────────────────────────────────────────────

export interface Workspace {
  id: WorkspaceId;
  name: string;
  slug: string;
  logoInitials: string;
  color: string; // tailwind bg class
}

// ─── User / Member ────────────────────────────────────────────────────────────

export interface User {
  id: UserId;
  name: string;
  email: string;
  initials: string;
  avatarColor: string; // hex or tailwind bg class
}

export interface WorkspaceMember {
  userId: UserId;
  workspaceId: WorkspaceId;
  role: Role;
  status: MemberStatus;
  /** for role=client, which client org they belong to */
  clientOrgId?: ClientOrgId;
  joinedAt: string; // ISO date
  user?: User;
}

// ─── Client Org ───────────────────────────────────────────────────────────────

export interface ClientOrg {
  id: ClientOrgId;
  workspaceId: WorkspaceId;
  name: string;
  contactName: string;
  contactEmail: string;
  projectIds: ProjectId[];
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: ProjectId;
  workspaceId: WorkspaceId;
  name: string;
  description: string;
  clientOrgId: ClientOrgId;
  status: ProjectStatus;
  startDate: string; // ISO date
  dueDate: string;   // ISO date
  memberIds: UserId[]; // agency members assigned
  createdAt: string;
  updatedAt: string;
  clientName?: string;
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: TaskId;
  workspaceId: WorkspaceId;
  projectId: ProjectId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: UserId | null;
  dueDate: string | null; // ISO date
  visibility: Visibility;
  commentCount: number;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Comment ──────────────────────────────────────────────────────────────────

export interface Comment {
  id: CommentId;
  taskId: TaskId;
  workspaceId: WorkspaceId;
  authorId: UserId;
  body: string;
  visibility: Visibility; // 'internal' = agency only
  createdAt: string;
  parentId: CommentId | null;
}

// ─── File ─────────────────────────────────────────────────────────────────────

export interface ProjectFile {
  id: FileId;
  workspaceId: WorkspaceId;
  projectId: ProjectId;
  taskId: TaskId | null;
  name: string;
  size: string; // e.g. "2.4 MB"
  type: string; // mime or display e.g. "PDF", "PNG"
  uploadedById: UserId;
  visibility: Visibility;
  reviewStatus: FileReviewStatus;
  reviewNote: string | null;
  createdAt: string;
}

// ─── Time Entry ───────────────────────────────────────────────────────────────

export interface TimeEntry {
  id: TimeEntryId;
  workspaceId: WorkspaceId;
  projectId: ProjectId;
  taskId: TaskId | null;
  userId: UserId;
  minutes: number;
  date: string; // ISO date
  note: string;
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'task_created'
  | 'task_moved'
  | 'task_assigned'
  | 'comment_added'
  | 'file_uploaded'
  | 'file_approved'
  | 'file_changes_requested'
  | 'member_joined'
  | 'member_removed'
  | 'project_created'
  | 'project_members_added'
  | 'time_logged'
  | 'invite_created'
  | 'invite_resent'
  | 'invite_revoked'
  | 'task_updated';

export interface ActivityEntry {
  id: string;
  workspaceId: WorkspaceId;
  projectId: ProjectId | null;
  taskId: TaskId | null;
  actorId: UserId;
  type: ActivityType;
  meta: Record<string, string>;
  createdAt: string;
}

// ─── Invite ───────────────────────────────────────────────────────────────────

export interface Invite {
  id: InviteId;
  workspaceId: WorkspaceId;
  email: string;
  role: Role;
  clientOrgId?: ClientOrgId;
  status: InviteStatus;
  createdAt: string;
}

// ─── Auth / Session ───────────────────────────────────────────────────────────

export interface AuthSession {
  userId: UserId;
  workspaceId: WorkspaceId;
  role: Role;
  token: string;
  membershipId: string;
  agencyId: string;
  agencyName: string;
  clientOrgId?: string;
  user: User;
}
