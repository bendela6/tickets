import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Query } from '@bh/resource';
import {
  useCreateRow,
  useDeleteRow,
  useResourceInfiniteQuery,
  useResourceMeta,
  useResourceQuery,
  useResourceRow,
  useUpdateRow,
} from './hooks';
import { resourceClient } from '@bh/resource/client';
import { resourceKeys } from './keys';
import { testServer, type Task } from './test/server';
import { testQueryClient, wrapperOf } from './test/wrapper';

// The hooks over @bh/source's router: each read, and each write followed by
// the lists the cache holds, which keep or drop the written row in its place
// without asking the server again. React Query tells its observers in a task
// of its own, so what a hook shows after a write is waited for; that the
// server wasn't asked again is read from its log.

const QUERY = 'POST /api/tasks/query';

const open: Query = {
  filter: { field: 'status.kind', op: 'in', value: ['open'] },
  sort: [{ field: 'points', dir: 'asc' }],
};
const done: Query = { filter: { field: 'status', op: 'equals', value: 'done' } };

/** The server, React Query's client, and a renderHook bound to both. */
function setup(viewer?: number) {
  const server = testServer(viewer);
  const queryClient = testQueryClient();
  const wrapper = wrapperOf(server.client, queryClient, viewer);
  const render = <Result,>(hook: () => Result) => renderHook(hook, { wrapper });
  return { ...server, queryClient, render };
}

/** The ids of a held answer's rows. */
const ids = (rows: readonly { id?: unknown }[] | undefined) => rows?.map((row) => row.id);

describe('the read hooks', () => {
  it('read the metadata, a query’s page and one row', async () => {
    const { render } = setup();
    const meta = render(() => useResourceMeta('tasks'));
    const page = render(() => useResourceQuery<Task>('tasks', { ...open, page: { take: 2 } }));
    const row = render(() => useResourceRow<Task>('tasks', 3));
    await waitFor(() => {
      expect(row.result.current.data?.title).toBe('Ship it');
      expect(ids(page.result.current.data?.rows)).toEqual([2, 4]);
      expect(meta.result.current.data?.roles.titleField).toBe('title');
    });
    expect(page.result.current.data?.page).toMatchObject({ more: true, total: 4 });
  });

  it('page after page by the cursor each answer gives', async () => {
    const { render } = setup();
    const list = render(() => useResourceInfiniteQuery<Task>('tasks', { ...open, take: 2 }));
    await waitFor(() => {
      expect(list.result.current.hasNextPage).toBe(true);
    });
    await act(() => list.result.current.fetchNextPage());
    await waitFor(() => {
      expect(list.result.current.data?.pages.map((page) => ids(page.rows))).toEqual([
        [2, 4],
        [1, 5],
      ]);
    });
    expect(list.result.current.hasNextPage).toBe(false);
  });

  it('answer the server’s error as a ResourceRequestError', async () => {
    const { render } = setup();
    const bad = render(() => {
      return useResourceQuery('tasks', { filter: { field: 'nope', op: 'equals', value: 1 } });
    });
    await waitFor(() => {
      expect(bad.result.current.error).toMatchObject({ status: 400, code: 'invalid' });
    });
  });
});

describe('a write', () => {
  it('puts a created row in its place in each list that keeps it, without asking again', async () => {
    const { render, asked } = setup();
    const opened = render(() => useResourceQuery<Task>('tasks', open));
    const closed = render(() => useResourceQuery<Task>('tasks', done));
    const create = render(() => useCreateRow<Task>('tasks'));
    await waitFor(() => {
      expect(ids(opened.result.current.data?.rows)).toEqual([2, 4, 1, 5]);
      expect(ids(closed.result.current.data?.rows)).toEqual([3]);
    });
    const before = asked(QUERY);
    await act(() => {
      return create.result.current.mutateAsync({ values: { title: 'Add search', points: 4 } });
    });
    await waitFor(() => {
      expect(ids(opened.result.current.data?.rows)).toEqual([2, 4, 1, 6, 5]);
    });
    expect(opened.result.current.data?.page.total).toBe(5);
    expect(ids(closed.result.current.data?.rows)).toEqual([3]);
    expect(asked(QUERY)).toBe(before);
  });

  it('moves an updated row from a list it left to one it entered, and caches the row', async () => {
    const { render, asked, queryClient } = setup();
    const opened = render(() => useResourceQuery<Task>('tasks', open));
    const closed = render(() => useResourceQuery<Task>('tasks', done));
    const update = render(() => useUpdateRow<Task>('tasks'));
    await waitFor(() => {
      expect(opened.result.current.data?.rows).toHaveLength(4);
      expect(closed.result.current.data?.rows).toHaveLength(1);
    });
    const before = asked(QUERY);
    await act(() => update.result.current.mutateAsync({ id: 1, values: { status: 'done' } }));
    await waitFor(() => {
      expect(ids(opened.result.current.data?.rows)).toEqual([2, 4, 5]);
      // done's own order is the resource's, by status, then the id.
      expect(ids(closed.result.current.data?.rows)).toEqual([1, 3]);
    });
    expect(opened.result.current.data?.page.total).toBe(3);
    expect(closed.result.current.data?.page.total).toBe(2);
    expect(asked(QUERY)).toBe(before);
    expect(queryClient.getQueryData(resourceKeys.row('tasks', 1))).toMatchObject({
      status: 'done',
    });
  });

  it('moves a row a write moved in its list’s order', async () => {
    const { render } = setup();
    const opened = render(() => useResourceQuery<Task>('tasks', open));
    const update = render(() => useUpdateRow<Task>('tasks'));
    await waitFor(() => {
      expect(ids(opened.result.current.data?.rows)).toEqual([2, 4, 1, 5]);
    });
    await act(() => update.result.current.mutateAsync({ id: 2, values: { points: 7 } }));
    await waitFor(() => {
      expect(ids(opened.result.current.data?.rows)).toEqual([4, 1, 2, 5]);
    });
  });

  it('takes a deleted row out of every list and forgets it', async () => {
    const { render, asked, queryClient, client } = setup();
    const opened = render(() => useResourceQuery<Task>('tasks', open));
    const remove = render(() => useDeleteRow('tasks'));
    queryClient.setQueryData(resourceKeys.row('tasks', 4), await client.read('tasks', 4));
    await waitFor(() => {
      expect(opened.result.current.data?.rows).toHaveLength(4);
    });
    const before = asked(QUERY);
    await act(() => remove.result.current.mutateAsync({ id: 4 }));
    await waitFor(() => {
      expect(ids(opened.result.current.data?.rows)).toEqual([2, 1, 5]);
    });
    expect(opened.result.current.data?.page.total).toBe(3);
    expect(asked(QUERY)).toBe(before);
    expect(queryClient.getQueryData(resourceKeys.row('tasks', 4))).toBeUndefined();
  });

  it('puts a row in the page it falls in, and leaves one past the last for the next page', async () => {
    const { render, asked } = setup();
    const list = render(() => useResourceInfiniteQuery<Task>('tasks', { ...open, take: 2 }));
    const create = render(() => useCreateRow<Task>('tasks'));
    await waitFor(() => {
      expect(list.result.current.data?.pages).toHaveLength(1);
    });
    const before = asked(QUERY);
    await act(() => create.result.current.mutateAsync({ values: { title: 'Tiny', points: 1.5 } }));
    await act(() => create.result.current.mutateAsync({ values: { title: 'Huge', points: 99 } }));
    await waitFor(() => {
      expect(list.result.current.data?.pages.map((page) => ids(page.rows))).toEqual([[2, 6, 4]]);
    });
    expect(asked(QUERY)).toBe(before);
    await act(() => list.result.current.fetchNextPage());
    await act(() => list.result.current.fetchNextPage());
    await waitFor(() => {
      expect(list.result.current.hasNextPage).toBe(false);
    });
    expect(list.result.current.data?.pages.flatMap((page) => ids(page.rows))).toEqual([
      2, 6, 4, 1, 5, 7,
    ]);
  });

  it('asks the server again for a grouped answer’s counts', async () => {
    const { render, asked } = setup();
    const groups = render(() => useResourceQuery('tasks', { group: { field: 'status' } }));
    const create = render(() => useCreateRow('tasks'));
    await waitFor(() => {
      expect(groups.result.current.data?.groups?.[0]?.count).toBe(3);
    });
    const before = asked(QUERY);
    await act(() => create.result.current.mutateAsync({ values: { title: 'One more' } }));
    await waitFor(() => {
      expect(groups.result.current.data?.groups?.[0]?.count).toBe(4);
    });
    expect(asked(QUERY)).toBe(before + 1);
  });

  it('keeps a row in a list of the viewer’s own by isMe', async () => {
    const { render } = setup(7);
    const mine = render(() => {
      return useResourceQuery<Task>('tasks', { filter: { field: 'owner', op: 'isMe' } });
    });
    const update = render(() => useUpdateRow<Task>('tasks'));
    await waitFor(() => {
      expect(ids(mine.result.current.data?.rows)).toEqual([1, 4]);
    });
    await act(() => update.result.current.mutateAsync({ id: 5, values: { owner: 7 } }));
    await act(() => update.result.current.mutateAsync({ id: 1, values: { owner: 8 } }));
    await waitFor(() => {
      expect(ids(mine.result.current.data?.rows)).toEqual([4, 5]);
    });
  });

  it('sends one Idempotency-Key per write, and answers the server’s refusal', async () => {
    const { render, received } = setup();
    const create = render(() => useCreateRow('tasks'));
    await act(async () => {
      await create.result.current.mutateAsync({ values: { title: 'A' } }).catch(() => undefined);
      await create.result.current.mutateAsync({ values: { points: 1 } }).catch(() => undefined);
    });
    await waitFor(() => {
      expect(create.result.current.error).toMatchObject({ status: 400, code: 'invalid' });
    });
    const keys = received
      .filter((each) => each.method === 'POST' && each.path === '/api/tasks')
      .map((each) => each.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('a write’s Idempotency-Key', () => {
  it('is the same on a retry, and new for the same object written again', async () => {
    const server = testServer();
    let failed = false;
    const tried: (string | null)[] = [];
    // The first request fails as a dropped connection does; the rest reach the server.
    const client = resourceClient({
      base: '/api',
      fetch: (input, init) => {
        if (String(input) === '/api/tasks') {
          tried.push(new Headers(init?.headers).get('idempotency-key'));
        }
        if (!failed) {
          failed = true;
          return Promise.reject(new TypeError('the connection dropped'));
        }
        return server.fetch(input, init);
      },
    });
    const wrapper = wrapperOf(client, testQueryClient());
    const create = renderHook(() => useCreateRow('tasks', { retry: 1, retryDelay: 0 }), {
      wrapper,
    });
    const values = { values: { title: 'Once' } };
    await act(() => create.result.current.mutateAsync(values));
    await act(() => create.result.current.mutateAsync(values));
    const [first, retry, again] = tried;
    expect(tried).toHaveLength(3);
    expect(retry).toBe(first);
    expect(again).not.toBe(first);
  });
});
