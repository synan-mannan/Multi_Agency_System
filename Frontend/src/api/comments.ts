import { request } from './client';
import type { ApiComment, ApiVisibility } from './types';

export const listComments = (taskId: string) =>
  request<ApiComment[]>(`/tasks/${encodeURIComponent(taskId)}/comments`);
export const createComment = (taskId: string, body: string, visibility: ApiVisibility) =>
  request<ApiComment>(`/tasks/${encodeURIComponent(taskId)}/comments`, {
    method: 'POST', body: JSON.stringify({ body, visibility }),
  });
