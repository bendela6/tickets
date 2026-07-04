import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { DeleteLinkInput } from './types';

export function useDeleteLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteLinkInput) => {
      return fetchJson<unknown>(`/api/links/${input.linkId}?actorId=${input.actorId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
