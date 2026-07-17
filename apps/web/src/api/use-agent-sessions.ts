import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AgentSession } from './types';

export function useAgentSessions(opts?: { archived?: boolean }) {
  const archived = opts?.archived ?? false;
  return useQuery({
    queryKey: ['agent', 'sessions', { archived }],
    queryFn: () =>
      fetchJson<AgentSession[]>(`/api/agent/sessions${archived ? '?archived=true' : ''}`),
    // Sessions are long-lived processes; poll so the list reflects status
    // transitions (running → exited) without a manual refresh.
    refetchInterval: 4000,
  });
}
