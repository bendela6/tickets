import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiSession } from './types';

export function useAiSessions(opts?: { archived?: boolean }) {
  const archived = opts?.archived ?? false;
  return useQuery({
    queryKey: ['ai', 'sessions', { archived }],
    queryFn: () => fetchJson<AiSession[]>(`/api/ai/sessions${archived ? '?archived=true' : ''}`),
    // Sessions are long-lived processes; poll so the list reflects status
    // transitions (running → exited) without a manual refresh.
    refetchInterval: 4000,
  });
}
