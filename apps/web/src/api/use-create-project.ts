import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MutationHookOptions } from './mutation-meta';

import { apiMutate } from './client';
import type { CreateProjectInput, Project } from './types';

export function useCreateProject(options: MutationHookOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: (input: CreateProjectInput) => {
      const { actorId, ...body } = input;
      return apiMutate<Project>('/api/projects', {
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
