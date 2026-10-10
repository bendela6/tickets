import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MutationHookOptions } from './mutation-meta';
import { apiMutate } from './client';
import type { CreateItemInput, CreatedItem } from './types';

export function useCreateItem(options: MutationHookOptions = {}) {
  const qc = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (input: CreateItemInput) => {
      const { projectKey, actorId, ...rest } = input;
      return apiMutate<CreatedItem>(`/api/projects/${encodeURIComponent(projectKey)}/items`, {
        method: 'POST', actorId, body: rest,
      });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
