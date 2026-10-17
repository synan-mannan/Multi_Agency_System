import { request } from './client';
import type { LoginResponse, MeResponse, SelectWorkspaceResponse } from './types';

export const login = (email: string, password: string, portal: boolean) =>
  request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, portal }),
  });

export const selectWorkspace = (identityToken: string, membershipId: string) =>
  request<SelectWorkspaceResponse>('/auth/select-workspace', {
    method: 'POST',
    headers: { Authorization: `Bearer ${identityToken}` },
    body: JSON.stringify({ membership_id: membershipId }),
  });

export const getMe = () => request<MeResponse>('/auth/me');
export const updateProfile = (fullName: string) =>
  request<MeResponse>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ full_name: fullName }),
  });
export const updateAgency = (agencyName: string) =>
  request<{ agency_id: string; agency_name: string }>('/auth/agency', {
    method: 'PATCH',
    body: JSON.stringify({ agency_name: agencyName }),
  });
