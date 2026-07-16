import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiAgent, PatchAiAgentInput } from './types';

export function usePatchAiAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PatchAiAgentInput) => {
      const { id, ...body } = input;
      return fetchJson<AiAgent>(`/api/ai/agents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai', 'agents'] });
    },
  });
}
