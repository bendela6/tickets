import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { Agent, CreateAgentInput } from './types';

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentInput) =>
      fetchJson<Agent>('/api/agent/agents', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent', 'agents'] });
    },
  });
}
