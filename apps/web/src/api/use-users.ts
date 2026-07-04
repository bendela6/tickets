import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { UsersResponse } from './types';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => fetchJson<UsersResponse>('/api/users'),
  });
}
