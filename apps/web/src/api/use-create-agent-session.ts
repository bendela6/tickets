import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AgentSession, CreateAgentSessionInput } from './types';

export function useCreateAgentSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentSessionInput) =>
      fetchJson<AgentSession>('/api/agent/sessions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent', 'sessions'] });
    },
  });
}
