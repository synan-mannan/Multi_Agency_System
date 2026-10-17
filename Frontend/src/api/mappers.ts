import type {
  ApiActivity, ApiClient, ApiComment, ApiFile, ApiInvite, ApiProject, ApiRole,
  ApiProjectMember, ApiTask, ApiTeamMember, ApiTimeEntry, MeResponse, WorkspaceChoice,
} from './types';
import type {
  ActivityEntry, AuthSession, ClientOrg, Comment, Invite, Persona, Project,
  ProjectFile, Role, Task, TimeEntry, User, Workspace, WorkspaceMember,
} from '@/types';

const personasByRole: Record<ApiRole, Persona> = {
  agency_admin: 'admin',
  agency_member: 'member',
  client_user: 'client',
};
export const personaFromRole = (role: ApiRole): Persona => personasByRole[role];

export const roleFromApi = (role: ApiRole): Role => personaFromRole(role);

export function mapWorkspace(choice: WorkspaceChoice): Workspace {
  const words = choice.agency_name.trim().split(/\s+/);
  return {
    id: choice.agency_id,
    name: choice.agency_name,
    slug: choice.agency_id,
    logoInitials: words.map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
    color: '#6366f1',
  };
}

export function mapUser(userId: string, email: string, name: string): User {
  const initials = name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return { id: userId, email, name, initials: initials || 'U', avatarColor: '#6366f1' };
}

export function mapSession(me: MeResponse, token: string): AuthSession {
  return {
    userId: me.user_id,
    workspaceId: me.agency_id,
    role: roleFromApi(me.role),
    token,
    membershipId: me.membership_id,
    agencyId: me.agency_id,
    agencyName: me.agency_name,
    clientOrgId: me.client_id ?? undefined,
    user: mapUser(me.membership_id, me.email, me.full_name),
  };
}

export function mapProjectMember(member: ApiProjectMember, workspaceId: string): WorkspaceMember {
  return {
    userId: member.membership_id,
    workspaceId,
    role: roleFromApi(member.role),
    status: 'active',
    joinedAt: '',
    user: mapUser(member.membership_id, member.email, member.full_name),
  };
}

export function mapMembership(member: ApiTeamMember, workspaceId: string): WorkspaceMember {
  return {
    userId: member.id,
    workspaceId,
    role: roleFromApi(member.role),
    status: member.status,
    clientOrgId: member.client_id ?? undefined,
    joinedAt: member.removed_at ?? '',
    user: mapUser(member.id, member.email, member.full_name),
  };
}

export function mapClient(client: ApiClient): ClientOrg {
  return {
    id: client.id,
    workspaceId: client.agency_id,
    name: client.org_name,
    contactName: client.contact_name ?? '',
    contactEmail: client.contact_email ?? '',
    projectIds: [],
  };
}

export function mapProject(project: ApiProject): Project {
  return {
    id: project.id,
    workspaceId: project.agency_id,
    name: project.name,
    description: project.description ?? '',
    clientOrgId: project.client_id,
    status: project.status as Project['status'],
    startDate: project.start_date ?? '',
    dueDate: project.due_date ?? '',
    memberIds: [],
    createdAt: project.created_at,
    updatedAt: project.updated_at ?? project.created_at,
    clientName: project.client_name,
  };
}

export function mapTask(task: ApiTask): Task {
  return {
    id: task.id,
    workspaceId: task.agency_id,
    projectId: task.project_id,
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    assigneeId: task.assignee_id,
    dueDate: task.due_date,
    visibility: task.visibility === 'client_visible' ? 'client' : 'internal',
    commentCount: task.comment_count ?? 0,
    fileCount: task.file_count ?? 0,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

export function mapComment(comment: ApiComment): Comment {
  return {
    id: comment.id,
    taskId: comment.task_id,
    workspaceId: comment.agency_id,
    authorId: comment.author_id,
    body: comment.body,
    visibility: comment.visibility === 'client_visible' ? 'client' : 'internal',
    createdAt: comment.created_at,
    parentId: comment.parent_id ?? null,
  };
}

export function mapFile(file: ApiFile): ProjectFile {
  const bytes = file.size_bytes;
  const size = bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
  const extension = file.original_name.split('.').pop()?.toUpperCase() ?? file.mime_type;
  return {
    id: file.id,
    workspaceId: file.agency_id ?? '',
    projectId: '',
    taskId: file.task_id,
    name: file.original_name,
    size,
    type: extension,
    uploadedById: file.uploaded_by ?? '',
    visibility: file.visibility === 'client_visible' ? 'client' : 'internal',
    reviewStatus: file.review_status,
    reviewNote: file.review_note,
    createdAt: file.created_at,
  };
}

export function mapTimeEntry(entry: ApiTimeEntry, projectId: string): TimeEntry {
  return {
    id: entry.id,
    workspaceId: entry.agency_id,
    projectId,
    taskId: entry.task_id,
    userId: entry.membership_id,
    minutes: entry.minutes,
    date: entry.entry_date,
    note: entry.note ?? '',
  };
}

export function mapInvite(invite: ApiInvite): Invite {
  return {
    id: invite.id,
    workspaceId: invite.agency_id,
    email: invite.email,
    role: roleFromApi(invite.role),
    clientOrgId: invite.client_id ?? undefined,
    status: invite.status,
    createdAt: invite.created_at,
  };
}

export function mapActivity(entry: ApiActivity, workspaceId: string): ActivityEntry {
  const actions: Record<string, ActivityEntry['type']> = {
    'task.created': 'task_created',
    'task.updated': 'task_updated',
    'comment.created': 'comment_added',
    'file.uploaded': 'file_uploaded',
    'file.reviewed': entry.details.status === 'approved' ? 'file_approved' : 'file_changes_requested',
    'project.created': 'project_created',
    'project.members_added': 'project_members_added',
    'team.member_removed': 'member_removed',
    'time.logged': 'time_logged',
    'invite.created': 'invite_created',
    'invite.resent': 'invite_resent',
    'invite.revoked': 'invite_revoked',
  };
  const fields = entry.details.fields;
  const actionType = entry.action === 'task.updated' && Array.isArray(fields)
    ? fields.includes('status') ? 'task_moved' : fields.includes('assignee_id') ? 'task_assigned' : 'task_updated'
    : actions[entry.action] ?? 'task_updated';
  const details = Object.fromEntries(Object.entries(entry.details).map(([key, value]) => [
    key,
    Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : String(value),
  ]));
  return {
    id: entry.id,
    workspaceId,
    projectId: typeof entry.details.project_id === 'string' ? entry.details.project_id : null,
    taskId: typeof entry.details.task_id === 'string' ? entry.details.task_id : null,
    actorId: entry.actor_id ?? '',
    type: actionType,
    meta: { ...details, actor_name: entry.actor_name ?? '' },
    createdAt: entry.created_at,
  };
}

export function projectWithMembers(project: Project, memberIds: string[]): Project {
  return { ...project, memberIds };
}
