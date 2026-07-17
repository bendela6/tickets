import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { AgentSession } from './types';

// Archiving a live agent session also stops it (the driver closes the run as
// part of the archive route) — there is no separate stop/DELETE endpoint any
// more.
function useSessionAction(action: 'archive' | 'unarchive') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<AgentSession>(`/api/agent/sessions/${id}/${action}`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['agent', 'sessions'] });
      void qc.invalidateQueries({ queryKey: ['agent', 'session', id] });
    },
  });
}

export const useArchiveAgentSession = () => useSessionAction('archive');
export const useUnarchiveAgentSession = () => useSessionAction('unarchive');
