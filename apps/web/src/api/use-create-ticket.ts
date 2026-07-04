import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { CreatedTicket, CreateTicketInput } from './types';

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) => {
      const { projectKey, ...body } = input;
      return fetchJson<CreatedTicket>(`/api/projects/${encodeURIComponent(projectKey)}/tickets`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
