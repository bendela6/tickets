import { describe, expect, it } from 'vitest';
import { ResourceRequestError } from './errors';
import { resourceClient, type ResourceClientOptions } from './fetcher';

// The fetcher's own side of each route: the method, the path, the body and
// the headers it sends, and how it reads what comes back. @bh/resource-query's
// tests run it against @bh/source's router, end to end.

interface Sent {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
  signal: AbortSignal | undefined;
}

/** A client whose fetch records each request and answers `answer`. */
function recording(answer: () => Response, options: ResourceClientOptions = {}) {
  const sent: Sent[] = [];
  const client = resourceClient({
    ...options,
    fetch: (input, init = {}) => {
      sent.push({
        url: String(input),
        method: init.method ?? 'GET',
        headers: new Headers(init.headers),
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        signal: init.signal ?? undefined,
      });
      return Promise.resolve(answer());
    },
  });
  return { client, sent };
}

const json = (body: unknown, status = 200) => {
  return () => {
    return Response.json(body, { status });
  };
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resourceClient', () => {
  it('reads the metadata, a query and a row from the routes under its base', async () => {
    const { client, sent } = recording(json({ rows: [], page: {} }), { base: '/api/' });
    await client.meta('tasks');
    await client.query('tasks', { filter: { field: 'status', op: 'equals', value: 'todo' } });
    await client.query('tasks');
    await client.read('tasks', 7);
    expect(sent.map(({ method, url, body }) => [method, url, body])).toEqual([
      ['GET', '/api/tasks/meta', undefined],
      ['POST', '/api/tasks/query', { filter: { field: 'status', op: 'equals', value: 'todo' } }],
      ['POST', '/api/tasks/query', {}],
      ['GET', '/api/tasks/7', undefined],
    ]);
    expect(sent[1]?.headers.get('content-type')).toBe('application/json');
    expect(sent[0]?.headers.get('accept')).toBe('application/json');
    expect(sent[0]?.headers.has('idempotency-key')).toBe(false);
  });

  it('writes with an Idempotency-Key on each, a fresh uuid unless one is given', async () => {
    const { client, sent } = recording(json({ id: 1 }, 201), { base: 'https://tasks.example/api' });
    await client.create('tasks', { values: { title: 'Ship it' } });
    await client.update('tasks', 1, { values: { title: 'Ship' }, version: 'v1' });
    await client.update('tasks', 1, { values: {} }, { idempotencyKey: 'again' });
    expect(sent.map(({ method, url, body }) => [method, url, body])).toEqual([
      ['POST', 'https://tasks.example/api/tasks', { values: { title: 'Ship it' } }],
      ['PATCH', 'https://tasks.example/api/tasks/1', { values: { title: 'Ship' }, version: 'v1' }],
      ['PATCH', 'https://tasks.example/api/tasks/1', { values: {} }],
    ]);
    const [first, second, third] = sent.map((each) => each.headers.get('idempotency-key'));
    expect(first).toMatch(UUID);
    expect(second).toMatch(UUID);
    expect(first).not.toBe(second);
    expect(third).toBe('again');
  });

  it('deletes with its version in the URL, and answers nothing for 204', async () => {
    const { client, sent } = recording(() => new Response(null, { status: 204 }));
    await expect(
      client.delete('tasks', 'a b/c', { version: '2026-10-14T00:53:56.753Z' }),
    ).resolves.toBeUndefined();
    await client.delete('tasks', 3);
    expect(sent.map(({ method, url }) => [method, url])).toEqual([
      ['DELETE', '/api/tasks/a%20b%2Fc?version=2026-10-14T00%3A53%3A56.753Z'],
      ['DELETE', '/api/tasks/3'],
    ]);
    expect(sent[0]?.headers.get('idempotency-key')).toMatch(UUID);
  });

  it('sends the app’s headers, from a function each time, beside its own', async () => {
    let token = 'one';
    const { client, sent } = recording(json({}), {
      headers: () => ({ authorization: `Bearer ${token}` }),
    });
    await client.meta('tasks');
    token = 'two';
    await client.meta('tasks');
    expect(sent.map((each) => each.headers.get('authorization'))).toEqual([
      'Bearer one',
      'Bearer two',
    ]);
  });

  it('passes the signal on, so a query no longer wanted is aborted', async () => {
    const { client, sent } = recording(json({ rows: [] }));
    const controller = new AbortController();
    await client.query('tasks', {}, { signal: controller.signal });
    expect(sent[0]?.signal).toBe(controller.signal);
  });

  it('throws an error answer as a ResourceRequestError, by its code', async () => {
    const issues = [{ path: ['filter', 'value'], message: 'no option "doing"' }];
    const { client } = recording(
      json({ error: { code: 'invalid', message: 'the query is invalid', issues } }, 400),
    );
    const error = await client.query('tasks', {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ResourceRequestError);
    expect(error).toMatchObject({
      status: 400,
      code: 'invalid',
      message: 'the query is invalid',
      issues,
    });
  });

  it('takes the code from the status when the body isn’t an ErrorBody', async () => {
    const page = () => {
      return new Response('<h1>Bad gateway</h1>', { status: 502, statusText: 'Bad Gateway' });
    };
    const missing = () => new Response('', { status: 404, statusText: 'Not Found' });
    await expect(recording(page).client.meta('tasks')).rejects.toMatchObject({
      status: 502,
      code: 'internal',
      message: '502 Bad Gateway',
      issues: [],
    });
    await expect(recording(missing).client.read('tasks', 1)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('refuses a success that isn’t JSON', async () => {
    const { client } = recording(() => new Response('<html>', { status: 200 }));
    await expect(client.meta('tasks')).rejects.toMatchObject({ code: 'internal' });
  });
});
