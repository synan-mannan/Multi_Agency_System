import type { ActivityEntry, ProjectId, Project, WorkspaceId, WorkspaceMember } from '@/types';

export function activityForProject(
  projectId: ProjectId | undefined,
  allActivity: ActivityEntry[] = [],
): ActivityEntry[] {
  return allActivity
    .filter((entry) => !projectId || entry.projectId === projectId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function projectAssignableMembers(
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  allProjects: Project[] = [],
  allMembers: WorkspaceMember[] = [],
): WorkspaceMember[] {
  const project = allProjects.find((item) => item.id === projectId && item.workspaceId === workspaceId);
  if (!project) return [];
  return allMembers.filter((member) =>
    member.workspaceId === workspaceId && member.status === 'active' && project.memberIds.includes(member.userId),
  );
}
