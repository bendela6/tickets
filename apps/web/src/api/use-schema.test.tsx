import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useDatabases, useSchemaGraph } from './use-schema';

afterEach(() => vi.unstubAllGlobals());
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

test('useDatabases GETs /api/schema/databases', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, text: () => Promise.resolve('{"databases":["tickets"],"current":"tickets"}') });
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useDatabases(), { wrapper: wrap });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const [url] = fetchMock.mock.calls[0] as [string];
  expect(url).toBe('/api/schema/databases');
});

test('useSchemaGraph(undefined) requests /api/schema with no query string', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{"tables":[],"groups":[]}') });
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useSchemaGraph(undefined), { wrapper: wrap });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const [url] = fetchMock.mock.calls[0] as [string];
  // Two URLs meaning "the default database" is the bug this guards against —
  // there must be no `?database=` at all, not an empty one.
  expect(url).toBe('/api/schema');
});

test('useSchemaGraph threads a clearly-non-default database name into the query string', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{"tables":[],"groups":[]}') });
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useSchemaGraph('archive_2019'), { wrapper: wrap });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const [url] = fetchMock.mock.calls[0] as [string];
  expect(url).toBe('/api/schema?database=archive_2019');
});
