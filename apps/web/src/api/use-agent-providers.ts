import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AgentProviderInfo } from './types';

export function useAgentProviders() {
  return useQuery({
    queryKey: ['agent', 'providers'],
    queryFn: () => fetchJson<AgentProviderInfo[]>('/api/agent/providers'),
    staleTime: Infinity, // a code registry — only changes on deploy
  });
}
