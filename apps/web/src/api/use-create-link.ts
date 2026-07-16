import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiMutate } from './client';
import type { CreateLinkInput, ItemLink } from './types';

export function useCreateLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLinkInput) => {
      const { actorId, ...rest } = input;
      return apiMutate<ItemLink>('/api/links', { method: 'POST', actorId, body: rest });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
