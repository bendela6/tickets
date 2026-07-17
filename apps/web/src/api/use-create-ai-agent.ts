import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiAgent, CreateAiAgentInput } from './types';

export function useCreateAiAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiAgentInput) =>
      fetchJson<AiAgent>('/api/ai/agents', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai', 'agents'] });
    },
  });
}
