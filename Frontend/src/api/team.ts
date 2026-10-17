import { request } from './client';
import type { ApiTeamMember } from './types';

export const listTeam = () => request<ApiTeamMember[]>('/team');
export const removeMember = (membershipId: string) =>
  request<{ removed: boolean }>(`/team/${encodeURIComponent(membershipId)}`, { method: 'DELETE' });
