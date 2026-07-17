import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AgentSession } from './types';

export function useAgentSession(sessionId: number) {
  return useQuery({
    queryKey: ['agent', 'session', sessionId],
    queryFn: () => fetchJson<AgentSession>(`/api/agent/sessions/${sessionId}`),
    refetchInterval: 4000,
  });
}
