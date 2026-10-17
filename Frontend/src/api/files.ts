import { request, upload, downloadFile } from './client';
import type { ApiFile } from './types';

export const listFiles = (taskId: string) =>
  request<ApiFile[]>(`/tasks/${encodeURIComponent(taskId)}/files`);
export const uploadFile = (taskId: string, file: File, visibility: string, onProgress?: (percent: number) => void) => {
  const form = new FormData();
  form.set('file', file);
  form.set('visibility', visibility);
  return upload<ApiFile>(`/tasks/${encodeURIComponent(taskId)}/files`, form, onProgress);
};
export const reviewFile = (id: string, status: 'approved' | 'changes_requested', note: string | null) =>
  request<{ id: string; review_status: ApiFile['review_status']; review_note: string | null }>(
    `/files/${encodeURIComponent(id)}/review`,
    { method: 'POST', body: JSON.stringify({ status, note }) },
  );
export const updateFileReview = reviewFile;
export { downloadFile };
