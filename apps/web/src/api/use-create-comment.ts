import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MutationHookOptions } from './mutation-meta';
import { apiMutate } from './client';
import type { Comment, CreateCommentInput } from './types';

export function useCreateComment(options: MutationHookOptions = {}) {
  const qc = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (input: CreateCommentInput) => {
      const { itemId, actorId, ...rest } = input;
      return apiMutate<Comment>(`/api/items/${itemId}/comments`, { method: 'POST', actorId, body: rest });
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['board'] }); },
  });
}
