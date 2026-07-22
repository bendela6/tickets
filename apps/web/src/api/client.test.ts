import { afterEach, expect, test, vi } from 'vitest';
import { apiMutate, fetchJson } from './client';
import { ApiError } from './api-error';

const { captureError } = vi.hoisted(() => ({ captureError: vi.fn() }));
vi.mock('@bendela6/signals-react', () => ({ captureError }));

afterEach(() => {
  vi.unstubAllGlobals();
  captureError.mockClear();
});

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

test('apiMutate: a stray actorId in the body cannot override the envelope actorId', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(JSON.stringify({ id: 1 })) });
  vi.stubGlobal('fetch', fetchMock);
  await apiMutate<{ id: number }>('/api/items/1', {
    method: 'PATCH',
    actorId: 7,
    body: { actorId: 999, archived: true },
  });
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
  expect(sent.actorId).toBe(7);
  expect(sent.archived).toBe(true);
});

test('a 500 response is captured to Signals and thrown as an ApiError', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: () => Promise.resolve(JSON.stringify({ error: 'boom' })),
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(fetchJson('/api/items/1')).rejects.toMatchObject({ status: 500, message: 'boom' });
  expect(captureError).toHaveBeenCalledTimes(1);
  expect(captureError).toHaveBeenCalledWith(
    expect.objectContaining({ status: 500, message: 'boom' }),
    { mechanism: 'manual', contexts: { http: { url: '/api/items/1', status: 500 } } },
  );
});

test('a 404 response is NOT captured to Signals (the API owns 4xx now)', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    text: () => Promise.resolve(JSON.stringify({ error: 'nope' })),
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(fetchJson('/api/items/1')).rejects.toBeInstanceOf(ApiError);
  expect(captureError).not.toHaveBeenCalled();
});

test('a network failure (fetch rejects) is captured to Signals and rethrown', async () => {
  const networkError = new TypeError('Failed to fetch');
  const fetchMock = vi.fn().mockRejectedValue(networkError);
  vi.stubGlobal('fetch', fetchMock);

  await expect(fetchJson('/api/items/1')).rejects.toBe(networkError);
  expect(captureError).toHaveBeenCalledTimes(1);
  expect(captureError).toHaveBeenCalledWith(
    networkError,
    { mechanism: 'manual', contexts: { http: { url: '/api/items/1' } } },
  );
});
