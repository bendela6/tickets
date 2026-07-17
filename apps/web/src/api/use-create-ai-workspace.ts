import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiWorkspace, CreateAiWorkspaceInput } from './types';

export function useCreateAiWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiWorkspaceInput) =>
      fetchJson<AiWorkspace>('/api/ai/workspaces', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai', 'workspaces'] });
    },
  });
}
