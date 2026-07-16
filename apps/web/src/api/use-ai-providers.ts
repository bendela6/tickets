import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';
import type { AiProvider } from './types';

export function useAiProviders() {
  return useQuery({
    queryKey: ['ai', 'providers'],
    queryFn: () => fetchJson<AiProvider[]>('/api/ai/providers'),
    staleTime: Infinity, // a code registry — only changes on deploy
  });
}
