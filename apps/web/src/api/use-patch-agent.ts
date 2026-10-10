import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MutationHookOptions } from './mutation-meta';

import { fetchJson } from './client';
import type { Agent, PatchAgentInput } from './types';

export function usePatchAgent(options: MutationHookOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
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
