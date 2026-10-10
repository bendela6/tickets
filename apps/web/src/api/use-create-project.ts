import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MutationHookOptions } from './mutation-meta';

import { apiMutate } from './client';
import type { CreateProjectInput } from './types';

export function useCreateProject(options: MutationHookOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (input: CreateProjectInput) => {
      const { actorId, ...body } = input;
      // project.create answers with the new id only.
      return apiMutate<{ id: number }>('/api/projects', {
        method: 'POST',
        actorId,
        body,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
