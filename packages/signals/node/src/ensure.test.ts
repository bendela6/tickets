import { describe, expect, it } from 'vitest';
import { ensureAppDsn } from './ensure';

function fakeResponse(status: number, body: unknown): Response {
  return { status, json: async () => body } as Response;
}

describe('ensureAppDsn (node)', () => {
  it('resolves the dsn from a stubbed 200', async () => {
    const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('http://127.0.0.1:4640/apps');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({ name: 'my-app', upsert: true });
      return fakeResponse(200, {
        id: 1,
        name: 'my-app',
        slug: 'my-app',
        ingestKey: 'k',
        createdAt: 'now',
        dsn: 'sgl://k@127.0.0.1:4640/1',
      });
    };
    const dsn = await ensureAppDsn({ name: 'my-app', fetchFn: fetchFn as typeof fetch });
    expect(dsn).toBe('sgl://k@127.0.0.1:4640/1');
  });

  it('honors a custom collectorUrl and accepts a 201', async () => {
    const fetchFn = async (url: string | URL | Request) => {
      expect(String(url)).toBe('http://collector.local:4640/apps');
      return fakeResponse(201, { dsn: 'sgl://k@collector.local:4640/2' });
    };
    const dsn = await ensureAppDsn({
      name: 'x',
      collectorUrl: 'http://collector.local:4640',
      fetchFn: fetchFn as typeof fetch,
    });
    expect(dsn).toBe('sgl://k@collector.local:4640/2');
  });

  it('resolves null on a non-2xx status', async () => {
    const fetchFn = async () => fakeResponse(500, { error: 'boom' });
    const dsn = await ensureAppDsn({ name: 'x', fetchFn: fetchFn as typeof fetch });
    expect(dsn).toBeNull();
  });

  it('resolves null when fetch throws', async () => {
    const fetchFn = async () => {
      throw new Error('network down');
    };
    const dsn = await ensureAppDsn({ name: 'x', fetchFn: fetchFn as typeof fetch });
    expect(dsn).toBeNull();
  });

  it('resolves null on malformed JSON', async () => {
    const fetchFn = async () =>
      ({ status: 200, json: async () => { throw new SyntaxError('bad json'); } }) as unknown as Response;
    const dsn = await ensureAppDsn({ name: 'x', fetchFn: fetchFn as typeof fetch });
    expect(dsn).toBeNull();
  });

  it('resolves null on timeout when fetch never resolves', async () => {
    const fetchFn = () => new Promise<Response>(() => {}); // never settles, ignores abort signal
    const dsn = await ensureAppDsn({ name: 'x', fetchFn: fetchFn as typeof fetch, timeoutMs: 20 });
    expect(dsn).toBeNull();
  });
});
