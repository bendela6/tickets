import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiSession } from './types';

export function useAiSessions() {
  return useQuery({
    queryKey: ['ai', 'sessions'],
    queryFn: () => fetchJson<AiSession[]>('/api/ai/sessions'),
    // Sessions are long-lived processes; poll so the list reflects status
    // transitions (running → exited) without a manual refresh.
    refetchInterval: 4000,
  });
}
