import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { AgentSession } from './types';

// Three separate acts, deliberately not folded together: `stop` closes the run
// and finalizes the row but leaves the session in the list to read; `archive`
// takes it off the list (stopping it first if it is still live); `unarchive`
// brings it back.
function useSessionAction(action: 'stop' | 'archive' | 'unarchive') {
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

export const useStopAgentSession = () => useSessionAction('stop');
export const useArchiveAgentSession = () => useSessionAction('archive');
export const useUnarchiveAgentSession = () => useSessionAction('unarchive');
