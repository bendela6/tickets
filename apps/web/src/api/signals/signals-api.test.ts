import { afterEach, expect, test, vi } from 'vitest';

import { createApp, getSession, listIssues, listOccurrences, patchIssueStatus } from './signals-api';

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown) {
  return { ok: true, text: () => Promise.resolve(JSON.stringify(body)) };
}

test('listIssues builds a query string that omits undefined filters, in fixed key order', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ rows: [], total: 0 }));
  vi.stubGlobal('fetch', fetchMock);

  await listIssues({ status: 'open', q: 'boom', days: 14 });

  const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/signals-api/issues?status=open&days=14&q=boom');
});

test('patchIssueStatus sends a PATCH with a JSON body of just {status}', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 3 }));
  vi.stubGlobal('fetch', fetchMock);

  await patchIssueStatus(3, 'resolved');

  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/signals-api/issues/3');
  expect(init.method).toBe('PATCH');
  expect(JSON.parse(String(init.body))).toEqual({ status: 'resolved' });
});

test('createApp POSTs {name} to /signals-api/apps', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse({ id: 1, name: 'X', slug: 'x', ingestKey: 'key', dsn: 'dsn', createdAt: '2026-07-22T00:00:00Z' }),
  );
  vi.stubGlobal('fetch', fetchMock);

  await createApp('X');

  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/signals-api/apps');
  expect(init.method).toBe('POST');
  expect(JSON.parse(String(init.body))).toEqual({ name: 'X' });
});

test('getSession hits /signals-api/sessions/:sessionId/signals', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse({
      session: {
        sessionId: 's1', appId: 1, startedAt: '2026-07-22T00:00:00Z', endedAt: null, durationMs: null,
        crashed: false, counts: { error: 0, log: 0, event: 0 }, release: null, platform: null,
      },
      rows: [],
    }),
  );
  vi.stubGlobal('fetch', fetchMock);

  await getSession('s1');

  const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/signals-api/sessions/s1/signals');
});

test('getSession sends the appId as ?app= (not ?appId=)', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    jsonResponse({
      session: {
        sessionId: 's1', appId: 1, startedAt: '2026-07-22T00:00:00Z', endedAt: null, durationMs: null,
        crashed: false, counts: { error: 0, log: 0, event: 0 }, release: null, platform: null,
      },
      rows: [],
    }),
  );
  vi.stubGlobal('fetch', fetchMock);

  await getSession('s1', 7);

  const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/signals-api/sessions/s1/signals?app=7');
});

test('listOccurrences hits /signals-api/issues/:id/signals (not /occurrences)', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ rows: [], total: 0 }));
  vi.stubGlobal('fetch', fetchMock);

  await listOccurrences(5, 2, 10);

  const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe('/signals-api/issues/5/signals?page=2&perPage=10');
});
