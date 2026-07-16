import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiSession } from './types';

export interface DispatchInput {
  agentId: number;
  ticketId: number;
  prompt: string;
  actorId?: number;
  parentSessionId?: number;
}

export function useDispatchAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DispatchInput) =>
      fetchJson<AiSession>('/api/ai/dispatch', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai', 'sessions'] });
    },
  });
}
