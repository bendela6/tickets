import { afterEach, expect, test, vi } from 'vitest';
import { apiMutate } from './client';

afterEach(() => vi.unstubAllGlobals());

test('apiMutate injects a uuid commandId + actorId into the JSON body', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(JSON.stringify({ id: 1 })) });
  vi.stubGlobal('fetch', fetchMock);
  const res = await apiMutate<{ id: number }>('/api/items/1', { method: 'PATCH', actorId: 7, body: { archived: true } });
  expect(res).toEqual({ id: 1 });
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/api/items/1');
  expect(init.method).toBe('PATCH');
  const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(sent.actorId).toBe(7);
  expect(sent.archived).toBe(true);
  expect(typeof sent.commandId).toBe('string');
  expect((sent.commandId as string)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});
