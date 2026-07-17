import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiAgent } from './types';

export function useAiAgents() {
  return useQuery({
    queryKey: ['ai', 'agents'],
    queryFn: () => fetchJson<AiAgent[]>('/api/ai/agents'),
  });
}
