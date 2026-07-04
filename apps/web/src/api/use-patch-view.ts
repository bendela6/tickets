import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { View } from './types';

export function usePatchView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      viewId: number;
      name?: string;
      config?: Record<string, unknown>;
      archived?: boolean;
    }) => {
      const { viewId, ...body } = input;
      return fetchJson<View>(`/api/views/${viewId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
