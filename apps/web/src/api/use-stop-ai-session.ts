import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';

export function useStopAiSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) =>
      fetchJson<{ ok: boolean; id: number }>(`/api/ai/sessions/${sessionId}`, {
        method: 'DELETE',
      }),
    onSuccess: async (_data, sessionId) => {
      await queryClient.invalidateQueries({ queryKey: ['ai', 'sessions'] });
      await queryClient.invalidateQueries({ queryKey: ['ai', 'session', sessionId] });
    },
  });
}
