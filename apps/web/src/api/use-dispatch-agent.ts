import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AgentSession } from './types';

export interface DispatchInput {
  agentId: number;
  itemId: number;
  prompt: string;
  actorId?: number;
  parentSessionId?: number;
}

export function useDispatchAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DispatchInput) =>
      fetchJson<AgentSession>('/api/agent/dispatch', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent', 'sessions'] });
    },
  });
}
