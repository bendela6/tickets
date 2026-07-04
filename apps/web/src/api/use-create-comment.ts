import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { CreateCommentInput, TicketComment } from './types';

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) => {
      const { ticketId, ...body } = input;
      return fetchJson<TicketComment>(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
