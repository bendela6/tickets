import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { WorkdirDirListing, WorkdirRoot } from './types';

// The configured browse roots (drives / home / etc.), fetched once.
export function useWorkdirRoots() {
  return useQuery({
    queryKey: ['workdir-roots'],
    queryFn: () => fetchJson<WorkdirRoot[]>('/api/workdirs/roots'),
  });
}

// Query descriptor for one directory's children — shared so the tree can also
// load imperatively via queryClient.fetchQuery and hit the same cache.
export function workdirDirQuery(path: string) {
  return {
    queryKey: ['workdir-dirs', path] as const,
    queryFn: () =>
      fetchJson<WorkdirDirListing>(`/api/workdirs/dirs?path=${encodeURIComponent(path)}`),
  };
}

// Lazy: pass enabled=true only once the node is expanded.
export function useWorkdirDir(path: string, enabled: boolean) {
  return useQuery({ ...workdirDirQuery(path), enabled });
}
