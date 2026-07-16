import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiWorkspace } from './types';

export function useAiWorkspaces() {
  return useQuery({
    queryKey: ['ai', 'workspaces'],
    queryFn: () => fetchJson<AiWorkspace[]>('/api/ai/workspaces'),
  });
}
