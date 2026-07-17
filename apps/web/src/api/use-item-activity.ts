import { useQuery } from '@tanstack/react-query';
import { fetchJson } from './client';
import type { ActivityEntry } from './types';

export function useItemActivity(itemId: number | null, take = 50) {
  return useQuery({
    queryKey: ['item-activity', itemId, take],
    enabled: itemId !== null,
    queryFn: () => fetchJson<ActivityEntry[]>(`/api/items/${itemId}/activity`),
  });
}
