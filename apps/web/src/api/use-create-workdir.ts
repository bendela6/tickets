import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MutationHookOptions } from './mutation-meta';

import { fetchJson } from './client';
import type { CreateWorkdirInput, Workdir } from './types';

export function useCreateWorkdir(options: MutationHookOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
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
