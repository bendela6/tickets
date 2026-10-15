import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Id } from '@bh/resource';
import type { ResourceClient } from '@bh/resource/client';
import { ResourceProvider } from '../provider';

/** React Query's client as a test wants it: no retries, nothing refetched behind its back. */
export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

/** What renderHook wraps a hook in: React Query's provider, then the resource one. */
export function wrapperOf(client: ResourceClient, queryClient: QueryClient, viewer?: Id) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ResourceProvider client={client} {...(viewer === undefined ? {} : { viewer })}>
          {children}
        </ResourceProvider>
      </QueryClientProvider>
    );
  };
}
