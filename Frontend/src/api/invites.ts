import { request } from './client';
import type { ApiInvite, ApiRole } from './types';

export const listInvites = () => request<ApiInvite[]>('/invites');
export const createInvite = (email: string, role: ApiRole, clientId: string | null) =>
  request<{ invite_id: string; token: string; expires_at: string }>('/invites', {
    method: 'POST', body: JSON.stringify({ email, role, client_id: clientId }),
  });
export const sendInvite = createInvite;
export const resendInvite = (id: string) =>
  request<{ invite_id: string; token: string; expires_at: string }>(`/invites/${encodeURIComponent(id)}/resend`, { method: 'POST' });
export const revokeInvite = (id: string) =>
  request<{ revoked: boolean }>(`/invites/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const acceptInvite = (token: string, fullName: string, password: string) =>
  request<{ accepted: boolean; user_id: string; membership_id: string }>('/invites/accept', {
    method: 'POST', body: JSON.stringify({ token, full_name: fullName, password }),
  });
