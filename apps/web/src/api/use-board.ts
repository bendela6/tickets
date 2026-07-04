import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { Board } from './types';

export function useBoard(projectKey: string) {
  return useQuery({
    queryKey: ['board', projectKey],
    queryFn: () => fetchJson<Board>(`/api/projects/${encodeURIComponent(projectKey)}/board`),
    refetchInterval: 10000,
  });
}
