import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate } from './client';
import type { DeleteLinkInput } from './types';

export function useDeleteLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeleteLinkInput) =>
      apiMutate<unknown>(`/api/links/${input.linkId}`, { method: 'DELETE', actorId: input.actorId }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
