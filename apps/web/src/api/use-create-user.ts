import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { CreateUserInput, User } from './types';

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => {
      return fetchJson<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
