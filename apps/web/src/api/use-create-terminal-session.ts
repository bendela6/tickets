import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { CreateTerminalSessionInput, TerminalSession } from './types';

export function useCreateTerminalSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTerminalSessionInput) =>
      fetchJson<TerminalSession>('/api/terminal/sessions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['terminal', 'sessions'] });
    },
  });
}
