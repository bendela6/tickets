import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { Workdir } from './types';

// Shared across terminal and agent — the one CRUD home for `core.workdirs`.
export function useWorkdirs() {
  return useQuery({
    queryKey: ['workdirs'],
    queryFn: () => fetchJson<Workdir[]>('/api/workdirs'),
  });
}
