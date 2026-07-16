import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiMutate } from './client';
import type { CreateProjectInput, Project } from './types';

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
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
