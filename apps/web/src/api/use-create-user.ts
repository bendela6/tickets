import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiMutate } from './client';
import type { CreateUserInput, User } from './types';

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => {
      const { actorId, ...body } = input;
      return apiMutate<User>('/api/users', {
        method: 'POST',
        actorId,
        body,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
