import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  Condition,
  FieldPath,
  Filter,
  Group,
  GroupBy,
  Page,
  PageResult,
  Query,
  QueryResult,
  Sort,
} from './query';
import type { Operator } from './types';
import type { Scalar } from './values';

describe('the query’s shapes', () => {
  it('leave every part of the body optional', () => {
    const everything: Query = {};
    expect(everything).toEqual({});
  });

  it('take one project’s open items, by a field and by an attribute’s path', () => {
    const open: Query = {
      filter: {
        all: [
          { field: 'project', op: 'equals', value: 'TIX' },
          { field: 'status.kind', op: 'in', value: ['todo', 'active', 'blocked'] },
        ],
      },
    };
    expect(open.filter).toBeDefined();
  });

  it('search by one term, and name the fields a row carries by their keys', () => {
    const query: Query = { search: 'login', fields: ['id', 'name', 'status'] };
    expectTypeOf<Query['search']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Query['fields']>().toEqualTypeOf<string[] | undefined>();
    // @ts-expect-error a search is text
    const number: Query = { search: 7 };
    // @ts-expect-error the fields are a list of keys
    const one: Query = { fields: 'name' };
    expect([query, number, one]).toHaveLength(3);
  });
});

describe('a page', () => {
  it('is numbered, by skip and take, or the one after a cursor', () => {
    const third: Page = { skip: 40, take: 20 };
    const first: Page = { take: 20 };
    const after: Page = { cursor: 'eyJpZCI6NDJ9', take: 20 };
    const query: Query = { page: third };
    expect([third, first, after, query]).toHaveLength(4);
  });

  it('never mixes the two shapes', () => {
    // @ts-expect-error a page after a cursor passes over nothing
    const both: Page = { skip: 40, cursor: 'eyJpZCI6NDJ9' };
    // @ts-expect-error a cursor is the text the page before answered
    const built: Page = { cursor: 42 };
    expect([both, built]).toHaveLength(2);
  });

  it('tells its shape by its cursor', () => {
    const shape = (page: Page) => {
      if (page.cursor !== undefined) {
        expectTypeOf(page).toEqualTypeOf<Extract<Page, { cursor: string }>>();
        return 'after a cursor';
      }
      expectTypeOf(page.skip).toEqualTypeOf<number | undefined>();
      return 'numbered';
    };
    expect(shape({ cursor: 'eyJpZCI6NDJ9' })).toBe('after a cursor');
    expect(shape({ skip: 40 })).toBe('numbered');
  });

  it('answers its rows, the next page’s cursor and the total, every time', () => {
    const last: QueryResult = {
      rows: [{ id: 7, name: 'TIX-7 Fix the login' }],
      page: { next: null, total: 41 },
    };
    expectTypeOf<PageResult>().toEqualTypeOf<{ next: string | null; total: number }>();
    // @ts-expect-error every page answers the total, numbered or not
    const uncounted: PageResult = { next: 'eyJpZCI6NDJ9' };
    // @ts-expect-error the last page's next is null, never absent
    const ended: PageResult = { total: 41 };
    expect([last, uncounted, ended]).toHaveLength(3);
  });
});

describe('a sort', () => {
  it('orders by fields and attributes’ paths, each up or down', () => {
    const urgent: Query = {
      sort: [
        { field: 'status.kind', dir: 'asc' },
        { field: 'priority', dir: 'desc' },
      ],
    };
    expectTypeOf<Sort['field']>().toEqualTypeOf<FieldPath>();
    expectTypeOf<Sort['dir']>().toEqualTypeOf<'asc' | 'desc'>();
    // @ts-expect-error a sort says its direction
    const undirected: Sort = { field: 'priority' };
    // @ts-expect-error up or down is asc or desc
    const up: Sort = { field: 'priority', dir: 'up' };
    expect([urgent, undirected, up]).toHaveLength(3);
  });
});

describe('a filter', () => {
  it('joins conditions by all, any and not, as deep as it needs', () => {
    // Items assigned to user 7 or to no one, that aren't finished.
    const mine: Filter = {
      all: [
        { not: { field: 'status.kind', op: 'in', value: ['done', 'dropped'] } },
        {
          any: [
            { field: 'assignee', op: 'equals', value: 7 },
            { field: 'assignee', op: 'empty' },
          ],
        },
      ],
    };
    const everyRow: Filter = { all: [] };
    const noRow: Filter = { any: [] };
    expect([mine, everyRow, noRow]).toHaveLength(3);
  });

  it('names a field by its path, a registered operator by its name, and compares with scalars', () => {
    expectTypeOf<FieldPath>().toEqualTypeOf<string>();
    expectTypeOf<Condition['op']>().toEqualTypeOf<Operator>();
    expectTypeOf<Condition['value']>().toEqualTypeOf<Scalar | Scalar[] | undefined>();
    // An app's own operator is named like bh's.
    const between: Condition = { field: 'estimate', op: 'between', value: [1, 8] };
    expect(between.op).toBe('between');
  });

  it('holds data, never code or anything JSON can’t carry', () => {
    // @ts-expect-error an operator that takes no operand leaves value out, never null
    const none: Condition = { field: 'assignee', op: 'empty', value: null };
    // @ts-expect-error a value is a scalar or a list of them
    const object: Condition = { field: 'status', op: 'equals', value: { value: 'todo' } };
    // @ts-expect-error a condition names its operator
    const bare: Condition = { field: 'status', value: 'todo' };
    // @ts-expect-error all joins a list
    const all: Filter = { all: { field: 'status', op: 'empty' } };
    // @ts-expect-error not turns one filter
    const not: Filter = { not: [{ field: 'status', op: 'empty' }] };
    expect([none, object, bare, all, not]).toHaveLength(5);
  });
});

describe('grouping', () => {
  it('asks for a board’s columns by a field or an attribute, empty ones too', () => {
    const board: Query = { filter: { all: [] }, group: { field: 'status', all: true } };
    const stats: Query = { group: { field: 'status.kind', dir: 'desc' } };
    expectTypeOf<GroupBy['field']>().toEqualTypeOf<FieldPath>();
    expectTypeOf<GroupBy['all']>().toEqualTypeOf<boolean | undefined>();
    // @ts-expect-error one field at a time
    const twoFields: GroupBy = { field: ['project', 'status'] };
    expect([board, stats, twoFields]).toHaveLength(3);
  });

  it('answers groups with their counts and no rows, each with the filter that picks its rows', () => {
    const query: Query = { filter: { field: 'project', op: 'equals', value: 'TIX' } };
    const todo: Group = {
      key: 'todo',
      count: 12,
      filter: { field: 'status', op: 'equals', value: 'todo' },
    };
    const none: Group = { key: null, count: 3, filter: { field: 'status', op: 'empty' } };
    const answer: QueryResult = { rows: [], groups: [todo, none], page: { next: null, total: 15 } };
    // A group's rows: the same query with the group's filter added, without `group`.
    const opened: Query = { ...query, filter: { all: [query.filter ?? { all: [] }, todo.filter] } };
    expectTypeOf<Group['key']>().toEqualTypeOf<Scalar | null>();
    // @ts-expect-error a group counts its rows; it carries none
    const withRows: Group = { ...todo, rows: [] };
    expect([answer, opened, withRows]).toHaveLength(3);
  });
});
