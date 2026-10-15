import { describe, expect, it } from 'vitest';
import { ResourceRequestError } from '@bh/resource/client';
import { testServer } from './test/server';

// @bh/resource/client's fetcher against @bh/source's router, end to end: the
// paths, bodies and answers it sends and reads are the ones the server
// serves, and each error answer is an ErrorBody it reads by its code.

/** The error a call rejected with. */
async function failure(call: Promise<unknown>): Promise<ResourceRequestError> {
  const error = await call.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ResourceRequestError)) {
    throw new Error(`expected a ResourceRequestError, got ${String(error)}`);
  }
  return error;
}

describe('the fetcher against @bh/source’s router', () => {
  it('reads the metadata the server makes from its source', async () => {
    const { client } = testServer();
    const meta = await client.meta('tasks');
    expect(meta.resource).toBe('tasks');
    expect(meta.serves).toMatchObject({ read: true, create: true, update: true, delete: true });
    expect(meta.fields.find((field) => field.key === 'status')?.query.filter).toContain('in');
  });

  it('asks a query, numbered, and reads its page and total', async () => {
    const { client } = testServer();
    const answer = await client.query('tasks', {
      filter: { field: 'status.kind', op: 'in', value: ['open'] },
      sort: [{ field: 'points', dir: 'desc' }],
      page: { skip: 1, take: 2 },
    });
    expect(answer.rows.map((row) => row['id'])).toEqual([1, 4]);
    expect(answer.page).toMatchObject({ more: true, total: 4 });
  });

  it('pages after the cursor each answer gives, to the last', async () => {
    const { client } = testServer();
    const sort = [{ field: 'points', dir: 'asc' }] as const;
    const seen: unknown[] = [];
    let page = await client.query('tasks', { sort: [...sort], page: { take: 2 } });
    seen.push(...page.rows.map((row) => row['id']));
    while (page.page.next !== null) {
      page = await client.query('tasks', {
        sort: [...sort],
        page: { cursor: page.page.next, take: 2 },
      });
      seen.push(...page.rows.map((row) => row['id']));
    }
    expect(seen).toEqual([2, 4, 1, 3, 5]);
    expect(page.page.more).toBe(false);
  });

  it('reads the groups a grouped query answers', async () => {
    const { client } = testServer();
    const answer = await client.query('tasks', { group: { field: 'status' } });
    expect(answer.rows).toEqual([]);
    expect(answer.groups?.map(({ key, count }) => [key, count])).toEqual([
      ['todo', 3],
      ['doing', 1],
      ['done', 1],
    ]);
  });

  it('creates, reads, updates and deletes a row, each write with its Idempotency-Key', async () => {
    const { client, received } = testServer();
    const created = await client.create('tasks', { values: { title: 'Add search', points: 4 } });
    expect(created).toEqual({ id: 6, title: 'Add search', status: 'todo', points: 4, owner: null });
    expect(await client.read('tasks', 6)).toEqual(created);
    const updated = await client.update('tasks', 6, { values: { status: 'doing' } });
    expect(updated['status']).toBe('doing');
    await client.delete('tasks', 6);
    expect((await failure(client.read('tasks', 6))).code).toBe('not_found');
    const writes = received.filter(
      (each) => each.method !== 'GET' && !each.path.endsWith('/query'),
    );
    expect(writes.map((each) => each.idempotencyKey)).toEqual([
      expect.any(String),
      expect.any(String),
      expect.any(String),
    ]);
  });

  it('throws the server’s invalid answer with each problem at its path', async () => {
    const { client } = testServer();
    const query = await failure(
      client.query('tasks', { filter: { field: 'status', op: 'equals', value: 'nope' } }),
    );
    expect(query).toMatchObject({ status: 400, code: 'invalid' });
    expect(query.issues.map((issue) => issue.path)).toContainEqual(['filter', 'value']);
    const create = await failure(client.create('tasks', { values: { points: 1 } }));
    expect(create).toMatchObject({ status: 400, code: 'invalid' });
    expect(create.issues.length).toBeGreaterThan(0);
  });

  it('throws not_found for a resource the server doesn’t serve', async () => {
    const { client } = testServer();
    expect(await failure(client.meta('nothing'))).toMatchObject({ status: 404, code: 'not_found' });
  });
});
