import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { CreateWorkdirInput, Workdir } from './types';

export function useCreateWorkdir() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkdirInput) =>
      fetchJson<Workdir>('/api/workdirs', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workdirs'] });
    },
  });
}
