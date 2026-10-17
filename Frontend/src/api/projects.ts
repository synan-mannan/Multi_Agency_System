import { request } from './client';
import type { ApiProject, ApiProjectMember } from './types';

export const listProjects = () => request<ApiProject[]>('/projects');
export const getProject = (id: string) => request<ApiProject>(`/projects/${encodeURIComponent(id)}`);
export const createProject = (input: {
  client_id: string; name: string; description: string; start_date: string | null; due_date: string | null;
}) => request<ApiProject>('/projects', { method: 'POST', body: JSON.stringify(input) });
export const getProjectMembers = (id: string) =>
  request<ApiProjectMember[]>(`/projects/${encodeURIComponent(id)}/members`);
