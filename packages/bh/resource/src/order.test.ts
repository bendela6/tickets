import { describe, expect, it } from 'vitest';
import type { ResourceMeta } from './meta';
import { rowOrder } from './order';
import type { Sort } from './query';
import { createRegistry } from './registry';
import type { FieldMeta } from './types';
import type { Id, Row } from './values';

const registry = createRegistry();
const write = { create: true, update: true, required: false };

/** A field that sorts. */
function field(key: string, type: FieldMeta['type']): FieldMeta {
  return {
    key,
    label: key,
    type,
    query: { filter: [], sort: true, group: false, search: false },
    write,
  };
}

const tasks: ResourceMeta = {
  resource: 'tasks',
  label: { one: 'Task', other: 'Tasks' },
  roles: { idField: 'id', titleField: 'title' },
  fields: [
    field('id', { kind: 'number', settings: { integer: true } }),
    field('title', { kind: 'text' }),
    field('status', {
      kind: 'option',
      settings: {
        // Their order isn't their labels' or their values' alphabetical one.
        options: [
          { value: 'todo', label: 'To do', order: 0, attributes: { kind: 'open' } },
          { value: 'doing', label: 'Doing', order: 1, attributes: { kind: 'open' } },
          { value: 'done', label: 'Done', order: 2, attributes: { kind: 'closed' } },
          { value: 'blocked', label: 'Blocked', order: 3, attributes: { kind: 'stuck' } },
        ],
        attributes: [
          {
            key: 'kind',
            label: 'Group',
            kind: 'option',
            options: [
              { value: 'stuck', label: 'Stuck', order: 0 },
              { value: 'open', label: 'Open', order: 1 },
              { value: 'closed', label: 'Closed', order: 2 },
            ],
          },
        ],
      },
    }),
    field('points', { kind: 'number' }),
    field('done', { kind: 'boolean' }),
    field('due', { kind: 'date' }),
    field('owner', { kind: 'ref', settings: { of: 'users' } }),
    field('tags', { kind: 'text', many: true }),
    field('data', { kind: 'json' }),
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

const users: Record<string, string> = { 7: 'Ada', 8: 'bob', 9: 'Cy' };
const titleOf = (resource: string, id: Id) => {
  return resource === 'users' ? users[String(id)] : undefined;
};

/** The ids of `rows` in the order `sort` gives them. */
function idsBy(sort: Sort[], rows: Row[]): unknown[] {
  const order = rowOrder(sort, tasks, registry, { titleOf });
  if (!order) {
    throw new Error('no order');
  }
  return [...rows].sort(order).map((row) => row['id']);
}

describe('rowOrder', () => {
  it('orders text alphabetically, case ignored', () => {
    const rows: Row[] = [
      { id: 1, title: 'cherry' },
      { id: 2, title: 'Banana' },
      { id: 3, title: 'apple' },
    ];
    expect(idsBy([{ field: 'title', dir: 'asc' }], rows)).toEqual([3, 2, 1]);
    expect(idsBy([{ field: 'title', dir: 'desc' }], rows)).toEqual([1, 2, 3]);
  });

  it('orders an option by its order, never its label or its value', () => {
    const rows: Row[] = [
      { id: 1, status: 'blocked' },
      { id: 2, status: 'done' },
      { id: 3, status: 'todo' },
      { id: 4, status: 'doing' },
    ];
    expect(idsBy([{ field: 'status', dir: 'asc' }], rows)).toEqual([3, 4, 2, 1]);
  });

  it('orders an attribute’s path by its own options’ order', () => {
    const rows: Row[] = [
      { id: 1, status: 'done' },
      { id: 2, status: 'blocked' },
      { id: 3, status: 'todo' },
    ];
    expect(idsBy([{ field: 'status.kind', dir: 'asc' }], rows)).toEqual([2, 3, 1]);
  });

  it('orders numbers, booleans and dates by value', () => {
    const rows: Row[] = [
      { id: 1, points: 10, done: true, due: '2026-12-01' },
      { id: 2, points: 2, done: false, due: '2026-01-31' },
      { id: 3, points: 5, done: true, due: '2026-06-15' },
    ];
    expect(idsBy([{ field: 'points', dir: 'asc' }], rows)).toEqual([2, 3, 1]);
    expect(idsBy([{ field: 'done', dir: 'asc' }], rows)).toEqual([2, 1, 3]);
    expect(idsBy([{ field: 'due', dir: 'desc' }], rows)).toEqual([1, 3, 2]);
  });

  it('orders a ref by the title of the row it points at', () => {
    const rows: Row[] = [
      { id: 1, owner: 9 },
      { id: 2, owner: 8 },
      { id: 3, owner: 7 },
    ];
    expect(idsBy([{ field: 'owner', dir: 'asc' }], rows)).toEqual([3, 2, 1]);
  });

  it('puts rows without a value last, both ways, a ref with no known title among them', () => {
    const rows: Row[] = [
      { id: 1, points: null, owner: 42 },
      { id: 2, points: 3, owner: 8 },
      { id: 3, owner: null },
      { id: 4, points: 1, owner: 7 },
    ];
    expect(idsBy([{ field: 'points', dir: 'asc' }], rows)).toEqual([4, 2, 1, 3]);
    expect(idsBy([{ field: 'points', dir: 'desc' }], rows)).toEqual([2, 4, 1, 3]);
    expect(idsBy([{ field: 'owner', dir: 'desc' }], rows)).toEqual([2, 4, 1, 3]);
  });

  it('breaks ties by each key in turn, then by the id', () => {
    const rows: Row[] = [
      { id: 10, status: 'todo', points: 1 },
      { id: 2, status: 'todo', points: 1 },
      { id: 3, status: 'todo', points: 5 },
      { id: 4, status: 'done', points: 9 },
    ];
    const sort: Sort[] = [
      { field: 'status', dir: 'asc' },
      { field: 'points', dir: 'desc' },
    ];
    expect(idsBy(sort, rows)).toEqual([3, 2, 10, 4]);
  });

  it('breaks a tie between text ids by code point, as the adapters do', () => {
    const texts: ResourceMeta = {
      ...tasks,
      fields: [field('id', { kind: 'text' }), field('title', { kind: 'text' })],
      sort: [],
    };
    const order = rowOrder([], texts, registry);
    if (!order) {
      throw new Error('no order');
    }
    const rows = [{ id: 'b' }, { id: 'B' }, { id: 'a' }];
    expect(rows.sort(order).map((row) => row.id)).toEqual(['B', 'a', 'b']);
  });

  it('orders nothing it can’t: a ref without titles, json, a field there isn’t', () => {
    expect(rowOrder([{ field: 'owner', dir: 'asc' }], tasks, registry)).toBeUndefined();
    expect(rowOrder([{ field: 'data', dir: 'asc' }], tasks, registry, { titleOf })).toBe(undefined);
    expect(rowOrder([{ field: 'nope', dir: 'asc' }], tasks, registry)).toBeUndefined();
    expect(rowOrder([{ field: 'title.nope', dir: 'asc' }], tasks, registry)).toBeUndefined();
  });

  it('passes over a list, which doesn’t sort', () => {
    const rows: Row[] = [
      { id: 2, tags: ['b'] },
      { id: 1, tags: ['a'] },
    ];
    expect(idsBy([{ field: 'tags', dir: 'asc' }], rows)).toEqual([1, 2]);
  });
});
