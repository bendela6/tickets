import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { CreateLinkInput, TicketLink } from './types';

export function useCreateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLinkInput) => {
      return fetchJson<TicketLink>('/api/links', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
