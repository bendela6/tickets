import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { LinkType } from './types';

export function useCreateLinkType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      projectKey: string;
      key: string;
      label: string;
      inverseLabel: string;
      directional: boolean;
    }) => {
      const { projectKey, ...body } = input;
      return fetchJson<LinkType>(`/api/projects/${encodeURIComponent(projectKey)}/link-types`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
