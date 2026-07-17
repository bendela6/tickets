import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { TerminalSession } from './types';

export function useTerminalSession(sessionId: number) {
  return useQuery({
    queryKey: ['terminal', 'session', sessionId],
    queryFn: () => fetchJson<TerminalSession>(`/api/terminal/sessions/${sessionId}`),
    refetchInterval: 4000,
  });
}
