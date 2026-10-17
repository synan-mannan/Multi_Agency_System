import { request } from './client';
import type { ApiTask } from './types';

export interface TaskQuery {
  q?: string;
  status?: ApiTask['status'];
  priority?: ApiTask['priority'];
  assignee?: string;
}

export const listTasks = (projectId: string, filters: TaskQuery = {}) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const suffix = query.size ? `?${query.toString()}` : '';
  return request<ApiTask[]>(`/projects/${encodeURIComponent(projectId)}/tasks${suffix}`);
};
export const getTask = (id: string) => request<ApiTask>(`/tasks/${encodeURIComponent(id)}`);
export const createTask = (projectId: string, input: {
  title: string; description: string; status: string; priority: string;
  visibility: string; assignee_id: string | null; due_date: string | null;
}) => request<ApiTask>(`/projects/${encodeURIComponent(projectId)}/tasks`, {
  method: 'POST', body: JSON.stringify(input),
});
export const patchTask = (id: string, input: Record<string, unknown>) =>
  request<ApiTask>(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
export const updateTask = patchTask;
