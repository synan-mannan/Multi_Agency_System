import { request } from './client';
import type { ApiActivity, ApiProjectDashboard } from './types';

export const getProjectDashboard = (projectId: string) =>
  request<ApiProjectDashboard>(`/projects/${encodeURIComponent(projectId)}/dashboard`);
export const getDashboard = () => request<{
  task_counts: Record<'todo' | 'in_progress' | 'in_review' | 'done', number>;
  hours_this_week: number;
  due_this_week: number;
  projects: Array<{ project_id: string; name: string; task_count: number; done_count: number }>;
  files_awaiting_review: number;
}>('/dashboard');
export const getActivity = () => request<ApiActivity[]>('/activity');
