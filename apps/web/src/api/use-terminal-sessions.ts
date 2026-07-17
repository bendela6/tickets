import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { TerminalSession } from './types';

export function useTerminalSessions(opts?: { archived?: boolean }) {
  const archived = opts?.archived ?? false;
  return useQuery({
    queryKey: ['terminal', 'sessions', { archived }],
    queryFn: () =>
      fetchJson<TerminalSession[]>(`/api/terminal/sessions${archived ? '?archived=true' : ''}`),
    // Sessions are long-lived processes; poll so the list reflects status
    // transitions (running → exited) without a manual refresh.
    refetchInterval: 4000,
  });
}
