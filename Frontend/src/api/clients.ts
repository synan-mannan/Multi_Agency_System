import { request } from './client';
import type { ApiClient } from './types';

export const listClients = () => request<ApiClient[]>('/clients');
