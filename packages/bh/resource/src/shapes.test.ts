import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ActionMeta, ActionResult, Job, type ActionInput } from './actions';
import { ErrorBody, issuesOf, type Issue } from './errors';
import { ResourceMeta } from './meta';
import {
  Filter,
  Page,
  Query,
  QueryResult,
  type Condition,
  type Group,
  type GroupBy,
  type PageResult,
  type Sort,
} from './query';
import type { FieldMeta } from './types';
import { Create, Patch } from './writes';
import { Json, Row, type FieldValue, type Scalar } from './values';

/** Where and why `schema` refuses `input`; [] when it takes it. */
function refusals(schema: v.GenericSchema, input: unknown): [string, string][] {
  const result = v.safeParse(schema, input);
  return result.success
    ? []
    : issuesOf(result.issues).map(({ path, message }) => [path.join('.'), message]);
}

/** Whether `schema` takes `input`. */
function takes(schema: v.GenericSchema, input: unknown): boolean {
  return v.safeParse(schema, input).success;
}

const status: FieldMeta = {
  key: 'status',
  label: 'Status',
  type: { kind: 'option', settings: { options: [{ value: 'todo', label: 'To do', order: 0 }] } },
  query: { filter: ['in'], sort: true, group: true, search: false },
  write: { create: true, update: true, required: true, default: 'todo' },
};

const items: ResourceMeta = {
  resource: 'items',
  label: { one: 'Item', other: 'Items' },
  roles: { idField: 'id', titleField: 'name' },
  fields: [status],
  sort: [{ field: 'status', dir: 'asc' }],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 10 },
    page: { numbered: 'any', cursor: true, total: true, max: 500 },
  },
  actions: [{ name: 'archive', label: 'Archive', on: 'row', input: [], long: false }],
};

describe('each shape’s type, inferred from its schema', () => {
  it('is the contract’s shape, key for key', () => {
    expectTypeOf<Sort>().toEqualTypeOf<{ field: string; dir: 'asc' | 'desc' }>();
    expectTypeOf<Condition>().toEqualTypeOf<{
      field: string;
      op: string;
      value?: Scalar | Scalar[];
    }>();
    expectTypeOf<GroupBy>().toEqualTypeOf<{
      field: string;
      dir?: 'asc' | 'desc';
      all?: boolean;
    }>();
    expectTypeOf<Group>().toEqualTypeOf<{ key: Scalar | null; count: number; filter: Filter }>();
    expectTypeOf<PageResult>().toEqualTypeOf<{
      next: string | null;
      more: boolean;
      total: number | null;
    }>();
    expectTypeOf<Query>().toEqualTypeOf<{
      filter?: Filter;
      search?: string;
      sort?: Sort[];
      page?: Page;
      group?: GroupBy;
      fields?: string[];
    }>();
    expectTypeOf<QueryResult>().toEqualTypeOf<{
      rows: Row[];
      groups?: Group[];
      page: PageResult;
    }>();
    expectTypeOf<Create>().toEqualTypeOf<{ values: Record<string, FieldValue> }>();
    expectTypeOf<Patch>().toEqualTypeOf<{ values: Record<string, FieldValue>; version?: string }>();
    expectTypeOf<ActionInput>().toEqualTypeOf<{ values: Record<string, FieldValue> }>();
    expectTypeOf<ActionMeta>().toEqualTypeOf<{
      name: string;
      label: string;
      on: 'row' | 'resource';
      input: FieldMeta[];
      long: boolean;
    }>();
    expectTypeOf<ResourceMeta['label']>().toEqualTypeOf<{ one: string; other: string }>();
  });

  it('matches the type written by hand where TypeScript can’t infer it', () => {
    expectTypeOf<v.InferOutput<typeof Filter>>().toEqualTypeOf<Filter>();
    expectTypeOf<v.InferOutput<typeof Json>>().toEqualTypeOf<Json>();
    expectTypeOf<v.InferOutput<typeof ErrorBody>>().toEqualTypeOf<ErrorBody<string>>();
    expectTypeOf<v.InferOutput<typeof Job>>().toEqualTypeOf<Job<string>>();
    expectTypeOf<v.InferOutput<typeof ActionResult>>().toEqualTypeOf<ActionResult<string>>();
  });
});

describe('the shapes, for any resource', () => {
  it('take the metadata, and refuse a key it doesn’t have', () => {
    expect(refusals(ResourceMeta, items)).toEqual([]);
    expect(refusals(ResourceMeta, { ...items, title: 'name' })[0]?.[0]).toBe('title');
    expect(refusals(ResourceMeta, { ...items, resource: 'my items' })[0]?.[0]).toBe('resource');
    const dotted = { ...items, fields: [{ ...status, key: 'status.kind' }] };
    expect(refusals(ResourceMeta, dotted)).toEqual([['fields.0.key', 'a field’s key has no dot']]);
  });

  it('take a query, every part of it optional', () => {
    expect(takes(Query, {})).toBe(true);
    const open = {
      filter: {
        all: [
          { field: 'project', op: 'equals', value: 'TIX' },
          { field: 'status.kind', op: 'in', value: ['todo', 'active', 'blocked'] },
        ],
      },
      sort: [{ field: 'priority', dir: 'asc' }],
      page: { take: 100 },
    };
    expect(refusals(Query, open)).toEqual([]);
  });

  it('report a problem deep in a filter at its own path', () => {
    const filter = {
      all: [
        { not: { field: 'status.kind', op: 'in', value: ['done'] } },
        { any: [{ field: 'assignee', op: 'equals', value: { id: 7 } }] },
      ],
    };
    expect(refusals(Query, { filter })[0]?.[0]).toBe('filter.all.1.any.0.value');
    expect(refusals(Filter, { all: [{ fild: 'x' }] })).toEqual([
      ['all.0', 'a filter is {all}, {any}, {not} or a condition {field, op, value}'],
    ]);
    expect(refusals(Filter, { field: 'a.b.c', op: 'empty' })[0]?.[0]).toBe('field');
  });

  it('page by skip and take or by a cursor, never both', () => {
    expect(takes(Page, { skip: 40, take: 20 })).toBe(true);
    expect(takes(Page, { cursor: 'eyJpZCI6NDJ9', take: 20 })).toBe(true);
    expect(refusals(Query, { page: { skip: 40, cursor: 'eyJpZCI6NDJ9' } })).toEqual([
      ['page', 'a page is {skip, take} or {cursor, take}, never both'],
    ]);
    for (const page of [{ take: 0 }, { take: 501 }, { take: 1.5 }, { skip: -1 }, { cursor: '' }]) {
      expect(takes(Page, page), JSON.stringify(page)).toBe(false);
    }
  });

  it('search 1 to 200 characters, and name fields by their keys', () => {
    expect(takes(Query, { search: 'login' })).toBe(true);
    expect(takes(Query, { search: '' })).toBe(false);
    expect(takes(Query, { search: 'x'.repeat(201) })).toBe(false);
    expect(takes(Query, { fields: 'name' })).toBe(false);
    expect(takes(Query, { sort: [{ field: 'priority', dir: 'up' }] })).toBe(false);
  });

  it('take an answer with its rows, its groups and its page', () => {
    const answer = {
      rows: [],
      groups: [
        { key: 'todo', count: 12, filter: { field: 'status', op: 'equals', value: 'todo' } },
      ],
      page: { next: null, more: false, total: 12 },
    };
    expect(refusals(QueryResult, answer)).toEqual([]);
    expect(takes(QueryResult, { rows: [], page: { next: null } })).toBe(false);
  });

  it('take writes under values, and a version only on a patch', () => {
    expect(takes(Create, { values: { title: 'Fix the login', labels: ['ui'] } })).toBe(true);
    expect(takes(Create, { title: 'Fix the login' })).toBe(false);
    expect(takes(Create, { values: {}, version: 'x' })).toBe(false);
    expect(takes(Patch, { values: { status: null }, version: '2026-10-14T00:53:56.753Z' })).toBe(
      true,
    );
    expect(takes(Patch, { values: {}, version: 3 })).toBe(false);
  });

  it('take an error body with any code, never a bare string', () => {
    const issues: Issue[] = [{ path: ['filter', 'all', 1, 'value'], message: 'no option "doing"' }];
    expect(takes(ErrorBody, { error: { code: 'invalid', message: 'x', issues } })).toBe(true);
    expect(takes(ErrorBody, { error: { code: 'unauthorized', message: 'sign in' } })).toBe(true);
    expect(takes(ErrorBody, { error: 'item not found' })).toBe(false);
    expect(takes(ErrorBody, { error: { message: 'no code' } })).toBe(false);
  });

  it('take an action’s answer, a job by its status, and its metadata', () => {
    expect(takes(ActionResult, { id: 7, state: 'paused' })).toBe(true);
    expect(takes(ActionResult, { job: { id: 'j-41', status: 'queued' } })).toBe(true);
    expect(takes(Job, { id: 'j-41', status: 'done', row: { id: 3 } })).toBe(true);
    expect(takes(Job, { id: 'j-42', status: 'failed' })).toBe(false);
    expect(takes(Job, { id: 'j-43', status: 'running', row: {} })).toBe(false);
    expect(takes(Job, { id: 'j-44', status: 'cancelled' })).toBe(false);
    expect(takes(ActionMeta, { ...items.actions[0], name: 'deploy now' })).toBe(false);
    expect(takes(ActionMeta, { ...items.actions[0], on: 'rows' })).toBe(false);
  });

  it('take any JSON in a json value, and nothing JSON can’t carry', () => {
    expect(takes(Json, { nested: [1, 'two', { three: true }], none: null })).toBe(true);
    expect(takes(Json, { when: undefined })).toBe(false);
    expect(takes(Json, Number.NaN)).toBe(false);
    expect(takes(Row, { id: 7, labels: ['ui'], data: { a: [1] }, none: null })).toBe(true);
  });
});
