import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiMutate } from './client';
import type { View } from './types';

export function useCreateView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      projectKey: string;
      actorId: number;
      name: string;
      config?: Record<string, unknown>;
    }) => {
      const { projectKey, actorId, ...body } = input;
      return apiMutate<View>(`/api/projects/${encodeURIComponent(projectKey)}/views`, {
        method: 'POST',
        actorId,
        body,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
