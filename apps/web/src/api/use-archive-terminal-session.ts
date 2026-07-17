import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { TerminalSession } from './types';

// Three separate acts, deliberately not folded together: `stop` kills the PTY
// and finalizes the row but leaves the session in the list to read; `archive`
// takes it off the list (stopping it first if it is still live); `unarchive`
// brings it back.
function useSessionAction(action: 'stop' | 'archive' | 'unarchive') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<TerminalSession>(`/api/terminal/sessions/${id}/${action}`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['terminal', 'sessions'] });
      void qc.invalidateQueries({ queryKey: ['terminal', 'session', id] });
    },
  });
}

export const useStopTerminalSession = () => useSessionAction('stop');
export const useArchiveTerminalSession = () => useSessionAction('archive');
export const useUnarchiveTerminalSession = () => useSessionAction('unarchive');
