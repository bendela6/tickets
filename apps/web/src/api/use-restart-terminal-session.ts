import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { TerminalSession } from './types';

// Respawn a PTY on the SAME session record (no new row). The server appends a
// divider + fresh shell below the existing scrollback; the caller re-attaches
// its socket from seq 0 to replay the continued transcript.
export function useRestartTerminalSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) =>
      fetchJson<TerminalSession>(`/api/terminal/sessions/${sessionId}/restart`, { method: 'POST' }),
    onSuccess: async (_row, sessionId) => {
      await queryClient.invalidateQueries({ queryKey: ['terminal', 'session', sessionId] });
      await queryClient.invalidateQueries({ queryKey: ['terminal', 'sessions'] });
    },
  });
}
