import { describe, expect, it } from 'vitest';
import { mapTask, personaFromRole } from './mappers';
import type { ApiTask } from './types';

describe('API mappers', () => {
  it('maps backend visibility and snake_case task fields to the existing UI shape', () => {
    const apiTask: ApiTask = {
      id: 'task-uuid',
      agency_id: 'agency-uuid',
      project_id: 'project-uuid',
      title: 'Review proposal',
      description: null,
      status: 'in_review',
      priority: 'high',
      visibility: 'client_visible',
      assignee_id: 'membership-uuid',
      due_date: '2026-06-01',
      created_at: '2026-05-01T09:00:00Z',
      updated_at: '2026-05-02T09:00:00Z',
      comment_count: 2,
      file_count: 1,
    };

    expect(mapTask(apiTask)).toEqual({
      id: 'task-uuid',
      workspaceId: 'agency-uuid',
      projectId: 'project-uuid',
      title: 'Review proposal',
      description: '',
      status: 'in_review',
      priority: 'high',
      assigneeId: 'membership-uuid',
      dueDate: '2026-06-01',
      visibility: 'client',
      commentCount: 2,
      fileCount: 1,
      createdAt: '2026-05-01T09:00:00Z',
      updatedAt: '2026-05-02T09:00:00Z',
    });
  });

  it('derives UI personas from backend membership roles', () => {
    expect(personaFromRole('agency_admin')).toBe('admin');
    expect(personaFromRole('agency_member')).toBe('member');
    expect(personaFromRole('client_user')).toBe('client');
  });
});
