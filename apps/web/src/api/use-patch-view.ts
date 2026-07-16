import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiMutate } from './client';
import type { View } from './types';

export function usePatchView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      viewId: number;
      actorId: number;
      name?: string;
      config?: Record<string, unknown>;
      archived?: boolean;
    }) => {
      const { viewId, actorId, ...body } = input;
      return apiMutate<View>(`/api/views/${viewId}`, {
        method: 'PATCH',
        actorId,
        body,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
