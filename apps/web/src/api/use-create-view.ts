import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { View } from './types';

export function useCreateView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectKey: string; name: string; config?: Record<string, unknown> }) => {
      const { projectKey, ...body } = input;
      return fetchJson<View>(`/api/projects/${encodeURIComponent(projectKey)}/views`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
