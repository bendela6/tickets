import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { TerminalSession } from './types';

// Archiving a live terminal also stops it (the driver kills the PTY as part
// of the archive route) — there is no separate stop/DELETE endpoint any more.
function useSessionAction(action: 'archive' | 'unarchive') {
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

export const useArchiveTerminalSession = () => useSessionAction('archive');
export const useUnarchiveTerminalSession = () => useSessionAction('unarchive');
