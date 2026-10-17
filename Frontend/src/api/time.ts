import { request } from './client';
import type { ApiProjectHours, ApiTimeEntry, ApiTimeWithProject } from './types';

export const logTime = (taskId: string, minutes: number, entryDate: string | null, note: string) =>
  request<ApiTimeEntry>(`/tasks/${encodeURIComponent(taskId)}/time`, {
    method: 'POST',
    body: JSON.stringify({ minutes, entry_date: entryDate, note }),
  });
export const getProjectHours = (projectId: string) =>
  request<ApiProjectHours>(`/projects/${encodeURIComponent(projectId)}/hours`);
export const listTaskTime = (taskId: string) =>
  request<ApiTimeWithProject[]>(`/tasks/${encodeURIComponent(taskId)}/time`);
