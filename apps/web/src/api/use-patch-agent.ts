import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { Agent, PatchAgentInput } from './types';

export function usePatchAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PatchAgentInput) => {
      const { id, ...body } = input;
      return fetchJson<Agent>(`/api/agent/agents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent', 'agents'] });
    },
  });
}
