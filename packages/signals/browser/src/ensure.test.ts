import { describe, expect, it } from 'vitest';
import { ensureAppDsn } from './ensure';

function fakeResponse(status: number, body: unknown): Response {
  return { status, json: async () => body } as Response;
}

describe('ensureAppDsn (browser)', () => {
  it('posts to /signals-api/apps and builds a host-rewritten DSN from ingestKey/id/location.hostname', async () => {
    expect(location.hostname).toBe('localhost');
    const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('/signals-api/apps');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({ name: 'my-app', upsert: true });
      return fakeResponse(200, {
        id: 7,
        name: 'my-app',
        slug: 'my-app',
        ingestKey: 'k7',
        createdAt: 'now',
        dsn: 'sgl://k7@127.0.0.1:4640/7',
      });
    };
    const dsn = await ensureAppDsn({ name: 'my-app', fetchFn: fetchFn as typeof fetch });
    expect(dsn).toBe('sgl://k7@localhost:4640/7');
  });

  it('honors a custom basePath and ingestHost', async () => {
    const fetchFn = async (url: string | URL | Request) => {
      expect(String(url)).toBe('/custom-base/apps');
      return fakeResponse(201, { id: 9, ingestKey: 'k9' });
    };
    const dsn = await ensureAppDsn({
      name: 'x',
      basePath: '/custom-base',
      ingestHost: 'lan-host:4640',
      fetchFn: fetchFn as typeof fetch,
    });
    expect(dsn).toBe('sgl://k9@lan-host:4640/9');
  });

  it('resolves null on a non-2xx status', async () => {
    const fetchFn = async () => fakeResponse(500, {});
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

  it('resolves null on timeout when fetch never resolves', async () => {
    const fetchFn = () => new Promise<Response>(() => {});
    const dsn = await ensureAppDsn({ name: 'x', fetchFn: fetchFn as typeof fetch, timeoutMs: 20 });
    expect(dsn).toBeNull();
  });
});
