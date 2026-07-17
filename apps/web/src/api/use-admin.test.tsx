import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useSetChildTypes } from './use-admin';

afterEach(() => vi.unstubAllGlobals());
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test('useSetChildTypes PUTs the envelope body to /api/types/:id/child-types', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{}') });
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useSetChildTypes(), { wrapper: wrap });
  await result.current.mutateAsync({ typeId: 1, actorId: 7, childTypeIds: [2, 3] });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/types/1/child-types');
  expect(init.method).toBe('PUT');
  const body = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(body.actorId).toBe(7);
  expect(String(body.commandId)).toMatch(UUID);
  expect(body.childTypeIds).toEqual([2, 3]);
});
