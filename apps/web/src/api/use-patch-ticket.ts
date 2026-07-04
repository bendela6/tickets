import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { PatchTicketInput, PatchTicketResult } from './types';

export function usePatchTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PatchTicketInput) => {
      const { ticketId, ...body } = input;
      return fetchJson<PatchTicketResult>(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
