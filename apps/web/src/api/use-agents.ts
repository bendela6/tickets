import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { Agent } from './types';

// The persona library (agent.agents) — not to be confused with agent
// *sessions* (use-agent-sessions.ts).
export function useAgents() {
  return useQuery({
    queryKey: ['agent', 'agents'],
    queryFn: () => fetchJson<Agent[]>('/api/agent/agents'),
  });
}
