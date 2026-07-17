import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiSession, CreateAiSessionInput } from './types';

export function useCreateAiSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiSessionInput) =>
      fetchJson<AiSession>('/api/ai/sessions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai', 'sessions'] });
    },
  });
}
