import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MutationHookOptions } from './mutation-meta';
import { apiMutate } from './client';
import type { CreateLinkInput, ItemLink } from './types';

export function useCreateLink(options: MutationHookOptions = {}) {
  const qc = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (input: CreateLinkInput) => {
      const { actorId, ...rest } = input;
      return apiMutate<ItemLink>('/api/links', { method: 'POST', actorId, body: rest });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
