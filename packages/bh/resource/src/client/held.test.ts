import { describe, expect, it } from 'vitest';
import type { ResourceMeta } from '../meta';
import type { Query, QueryResult } from '../query';
import { createRegistry } from '../registry';
import type { FieldMeta } from '../types';
import type { Id, Row } from '../values';
import {
  answerAfterDelete,
  answerAfterWrite,
  keepsRow,
  pagesAfterDelete,
  pagesAfterWrite,
  type HeldContext,
} from './held';

// A list the client holds, after a row it just wrote: kept or dropped by
// the query's filter and search, and put in its place by the query's
// order, without asking the server again.

const registry = createRegistry();
const write = { create: true, update: true, required: false };

function field(key: string, type: FieldMeta['type'], filter: string[] = []): FieldMeta {
  return {
    key,
    label: key,
    type,
    query: { filter, sort: true, group: type.kind === 'option', search: key === 'title' },
    write,
  };
}

const tasks: ResourceMeta = {
  resource: 'tasks',
  label: { one: 'Task', other: 'Tasks' },
  roles: { idField: 'id', titleField: 'title' },
  fields: [
    field('id', { kind: 'number', settings: { integer: true } }),
    field('title', { kind: 'text' }, ['contains']),
    field(
      'status',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'todo', label: 'To do', order: 0 },
            { value: 'doing', label: 'Doing', order: 1 },
            { value: 'done', label: 'Done', order: 2 },
          ],
        },
      },
      ['equals', 'in'],
    ),
    field('points', { kind: 'number' }, ['gte']),
    field('owner', { kind: 'ref', settings: { of: 'users' } }, ['isMe']),
  ],
  sort: [{ field: 'status', dir: 'asc' }],
  actions: [],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 10 },
    page: { numbered: 'any', cursor: true, total: true, max: 500 },
  },
};

const open = { field: 'status', op: 'in', value: ['todo', 'doing'] };
const byPoints: Query = { filter: open, sort: [{ field: 'points', dir: 'asc' }] };

function task(id: number, points: number, status = 'todo', owner: Id | null = null): Row {
  return { id, title: `Task ${String(id)}`, status, points, owner };
}

function answer(rows: Row[], more = false, total: number | null = rows.length): QueryResult {
  return { rows, page: { next: null, more, total } };
}

function context(query: Query, extra: Partial<HeldContext> = {}): HeldContext {
  return { query, meta: tasks, registry, ...extra };
}

const ids = (result: QueryResult | undefined) => result?.rows.map((row) => row['id']);

describe('keepsRow', () => {
  it('holds where the filter and the search both do', () => {
    const query: Query = { filter: open, search: 'task 1' };
    expect(keepsRow(task(1, 1), context(query))).toBe(true);
    expect(keepsRow(task(2, 1), context(query))).toBe(false);
    expect(keepsRow(task(1, 1, 'done'), context(query))).toBe(false);
  });

  it('reads isMe as the viewer', () => {
    const mine: Query = { filter: { field: 'owner', op: 'isMe' } };
    expect(keepsRow(task(1, 1, 'todo', 7), context(mine, { viewer: 7 }))).toBe(true);
    expect(keepsRow(task(1, 1, 'todo', 7), context(mine, { viewer: 8 }))).toBe(false);
    expect(keepsRow(task(1, 1, 'todo', 7), context(mine))).toBe(false);
  });
});

describe('answerAfterWrite', () => {
  const held = answer([task(1, 1), task(2, 3), task(3, 5)]);

  it('puts a new row the query keeps in its place, one more in the total', () => {
    const after = answerAfterWrite(held, task(9, 4), null, context(byPoints));
    expect(ids(after)).toEqual([1, 2, 9, 3]);
    expect(after?.page.total).toBe(4);
  });

  it('leaves out a new row the query doesn’t keep', () => {
    const after = answerAfterWrite(held, task(9, 4, 'done'), null, context(byPoints));
    expect(ids(after)).toEqual([1, 2, 3]);
    expect(after?.page.total).toBe(3);
  });

  it('drops a row a write took out of the filter, one fewer in the total', () => {
    const after = answerAfterWrite(held, task(2, 3, 'done'), task(2, 3), context(byPoints));
    expect(ids(after)).toEqual([1, 3]);
    expect(after?.page.total).toBe(2);
  });

  it('moves a row a write moved in the order, the total as it was', () => {
    const after = answerAfterWrite(held, task(1, 9), undefined, context(byPoints));
    expect(ids(after)).toEqual([2, 3, 1]);
    expect(after?.rows.at(-1)).toEqual(task(1, 9));
    expect(after?.page.total).toBe(3);
  });

  it('keeps a row past the last it holds out while rows follow it', () => {
    const more = answer([task(1, 1), task(2, 3)], true, 10);
    const after = answerAfterWrite(more, task(9, 8), null, context(byPoints));
    expect(ids(after)).toEqual([1, 2]);
    expect(after?.page.total).toBe(11);
  });

  it('keeps a row before the first it holds out while rows come before it', () => {
    const query: Query = { ...byPoints, page: { skip: 2, take: 2 } };
    const page2 = answer([task(3, 5), task(4, 7)], true, 6);
    const after = answerAfterWrite(page2, task(9, 0), null, context(query));
    expect(ids(after)).toEqual([3, 4]);
    expect(after?.page.total).toBe(7);
  });

  it('passes a numbered page’s last row on when the page grows past its take', () => {
    const query: Query = { ...byPoints, page: { take: 3 } };
    const after = answerAfterWrite(held, task(9, 2), null, context(query));
    expect(ids(after)).toEqual([1, 9, 2]);
    expect(after?.page.more).toBe(true);
  });

  it('carries only the fields the query asked for, and those its roles name', () => {
    const query: Query = { ...byPoints, fields: ['points'] };
    const trimmed = answer([
      { id: 1, title: 'Task 1', points: 1 },
      { id: 3, title: 'Task 3', points: 5 },
    ]);
    const after = answerAfterWrite(trimmed, task(9, 4), null, context(query));
    expect(after?.rows[1]).toEqual({ id: 9, title: 'Task 9', points: 4 });
  });

  it('can’t tell where a row goes by a key the held rows don’t carry', () => {
    const query: Query = { ...byPoints, fields: ['title'] };
    expect(answerAfterWrite(held, task(9, 4), null, context(query))).toBeUndefined();
  });

  it('orders by a ref’s title only when it knows every one', () => {
    const query: Query = { sort: [{ field: 'owner', dir: 'asc' }] };
    const names: Record<string, string> = { 7: 'Ada', 8: 'Bob', 9: 'Cy' };
    const titleOf = (_resource: string, id: Id) => names[String(id)];
    const byOwner = answer([task(1, 1, 'todo', 7), task(2, 1, 'todo', 9)]);
    const after = answerAfterWrite(
      byOwner,
      task(5, 1, 'todo', 8),
      null,
      context(query, { titleOf }),
    );
    expect(ids(after)).toEqual([1, 5, 2]);
    const stranger = task(6, 1, 'todo', 42);
    expect(answerAfterWrite(byOwner, stranger, null, context(query, { titleOf }))).toBeUndefined();
    expect(answerAfterWrite(byOwner, task(5, 1, 'todo', 8), null, context(query))).toBeUndefined();
  });

  it('leaves a grouped answer’s counts to the server', () => {
    const grouped: QueryResult = {
      rows: [],
      groups: [],
      page: { next: null, more: false, total: 3 },
    };
    const query: Query = { group: { field: 'status' } };
    expect(answerAfterWrite(grouped, task(9, 1), null, context(query))).toBeUndefined();
    expect(answerAfterDelete(grouped, 1, undefined, context(query))).toBeUndefined();
  });

  it('keeps a total the source doesn’t count as none', () => {
    const uncounted = answer([task(1, 1)], false, null);
    expect(answerAfterWrite(uncounted, task(9, 4), null, context(byPoints))?.page.total).toBeNull();
  });
});

describe('answerAfterDelete', () => {
  it('takes the row out, one fewer in the total when the query kept it', () => {
    const held = answer([task(1, 1), task(2, 3)], true, 5);
    const after = answerAfterDelete(held, 2, undefined, context(byPoints));
    expect(ids(after)).toEqual([1]);
    expect(after?.page.total).toBe(4);
    const elsewhere = answerAfterDelete(held, 8, task(8, 1, 'done'), context(byPoints));
    expect(elsewhere?.page.total).toBe(5);
  });
});

describe('pagesAfterWrite', () => {
  const pages = [
    answer([task(1, 1), task(2, 3)], true, 5),
    answer([task(3, 5), task(4, 7)], true, 5),
  ];

  it('puts a row in the page it falls in, and every page’s total moves', () => {
    const after = pagesAfterWrite(pages, task(9, 4), null, context(byPoints));
    expect(after?.map(ids)).toEqual([
      [1, 2],
      [9, 3, 4],
    ]);
    expect(after?.map((each) => each.page.total)).toEqual([6, 6]);
  });

  it('moves a row from one page to another', () => {
    const after = pagesAfterWrite(pages, task(4, 0), undefined, context(byPoints));
    expect(after?.map(ids)).toEqual([[4, 1, 2], [3]]);
  });

  it('leaves a row past the last page to come with the next one', () => {
    const after = pagesAfterWrite(pages, task(9, 8), null, context(byPoints));
    expect(after?.map(ids)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('puts a row last when no page follows', () => {
    const last = [pages[0] as QueryResult, answer([task(3, 5)], false, 3)];
    const after = pagesAfterWrite(last, task(9, 8), null, context(byPoints));
    expect(after?.map(ids)).toEqual([
      [1, 2],
      [3, 9],
    ]);
  });

  it('takes a deleted row out of the page that held it', () => {
    const after = pagesAfterDelete(pages, 3, undefined, context(byPoints));
    expect(after?.map(ids)).toEqual([[1, 2], [4]]);
    expect(after?.map((each) => each.page.total)).toEqual([4, 4]);
  });
});
