import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { Item } from './types';

/** `GET /api/items/by-key/:key`: one item, in whichever project it is. */
export type ItemByKey = Item & { projectKey: string; typeKey: string | null };

export function useItemByKey(itemKey: string) {
  return useQuery({
    queryKey: ['item-by-key', itemKey],
    queryFn: () => fetchJson<ItemByKey>(`/api/items/by-key/${encodeURIComponent(itemKey)}`),
    retry: false,
  });
}
