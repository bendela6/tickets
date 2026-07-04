import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { Project } from './types';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchJson<{ data: Project[] }>('/api/projects'),
  });
}
