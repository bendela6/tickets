import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiSession } from './types';

export function useAiSession(sessionId: number) {
  return useQuery({
    queryKey: ['ai', 'session', sessionId],
    queryFn: () => fetchJson<AiSession>(`/api/ai/sessions/${sessionId}`),
    refetchInterval: 4000,
  });
}
