import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { AiSession } from './types';

function useSessionAction(action: 'archive' | 'unarchive') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<AiSession>(`/api/ai/sessions/${id}/${action}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai', 'sessions'] }),
  });
}

export const useArchiveSession = () => useSessionAction('archive');
export const useUnarchiveSession = () => useSessionAction('unarchive');
