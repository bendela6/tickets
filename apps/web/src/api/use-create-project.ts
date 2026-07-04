import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { Project } from './types';

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; name: string; ticketPrefix: string }) => {
      return fetchJson<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
