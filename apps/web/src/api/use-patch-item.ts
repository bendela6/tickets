import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate } from './client';
import type { PatchItemInput, PatchItemResult } from './types';

export function usePatchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PatchItemInput) => {
      const { itemId, actorId, ...rest } = input;
      return apiMutate<PatchItemResult>(`/api/items/${itemId}`, { method: 'PATCH', actorId, body: rest });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
