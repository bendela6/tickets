import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryOf } from './checks';
import { matchesFilter, matchesSearch } from './matches';
import type { ResourceMeta } from './meta';
import { baseOperators } from './operators';
import type { Filter } from './query';
import { createRegistry } from './registry';
import type { FieldMeta, OperatorSpec } from './types';
import type { Row } from './values';

const write = { create: true, update: true, required: false };

/** A field of `kind` that a query filters by `filter`. */
function field(key: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label: key,
    type,
    query: { filter, sort: false, group: false, search: false },
    write,
  };
}

const kinds = [
  { value: 'todo', label: 'To do', order: 0 },
  { value: 'active', label: 'Active', order: 1 },
  { value: 'done', label: 'Done', order: 2 },
];

const items: ResourceMeta = {
  resource: 'items',
  label: { one: 'Item', other: 'Items' },
  roles: { idField: 'id', titleField: 'title' },
  fields: [
    field('id', { kind: 'number' }, ['equals']),
    field('title', { kind: 'text' }, ['contains', 'startsWith', 'empty']),
    field(
      'status',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'todo', label: 'To do', order: 0, attributes: { kind: 'todo' } },
            { value: 'doing', label: 'Doing', order: 1, attributes: { kind: 'active' } },
            { value: 'shipped', label: 'Shipped', order: 2, attributes: { kind: 'done' } },
            { value: 'triage', label: 'Triage', order: 3 },
          ],
          attributes: [{ key: 'kind', label: 'Group', kind: 'option', options: kinds }],
        },
      },
      ['equals', 'notEquals', 'in', 'notIn', 'empty'],
    ),
    field(
      'labels',
      {
        kind: 'option',
        many: true,
        settings: {
          options: [
            { value: 'ui', label: 'UI', order: 0, attributes: { team: 'web' } },
            { value: 'api', label: 'API', order: 1, attributes: { team: 'core' } },
            { value: 'docs', label: 'Docs', order: 2 },
          ],
          attributes: [{ key: 'team', label: 'Team', kind: 'text' }],
        },
      },
      ['in', 'notIn', 'empty', 'notEmpty'],
    ),
    field('assignee', { kind: 'ref', settings: { of: 'users' } }, ['equals', 'empty', 'isMe']),
    field('updatedAt', { kind: 'datetime' }, ['gte', 'inLast', 'notInLast']),
    field('services', { kind: 'json' }, ['empty', 'notEmpty']),
  ],
  sort: [],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 10 },
    page: { numbered: 'any', cursor: true, total: true, max: 500 },
  },
  actions: [],
};

const registry = createRegistry();

const fix: Row = {
  id: 7,
  title: 'Fix the login',
  status: 'doing',
  labels: ['ui', 'api'],
  assignee: 3,
  updatedAt: '2026-10-12T09:30:00.000Z',
  services: [{ name: 'web', state: 'running' }],
};
const triage: Row = { id: 8, title: 'Docs', status: 'triage', labels: [], assignee: null };

/** Whether `row` passes `filter`, viewed by `viewer`. */
function passes(filter: Filter, row: Row = fix, viewer?: number): boolean {
  return matchesFilter(filter, row, items, registry, viewer);
}

describe('matchesFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-14T09:30:00.000Z') });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds a condition by its operator’s matches', () => {
    expect(passes({ field: 'status', op: 'equals', value: 'doing' })).toBe(true);
    expect(passes({ field: 'title', op: 'contains', value: 'LOGIN' })).toBe(true);
    expect(passes({ field: 'status', op: 'notEquals', value: 'doing' })).toBe(false);
    expect(passes({ field: 'updatedAt', op: 'inLast', value: 7 })).toBe(true);
    expect(passes({ field: 'updatedAt', op: 'inLast', value: 1 })).toBe(false);
  });

  it('joins conditions by all, any and not; an empty all keeps a row, an empty any drops it', () => {
    const open: Filter = {
      all: [
        { not: { field: 'status', op: 'in', value: ['shipped'] } },
        {
          any: [
            { field: 'assignee', op: 'equals', value: 3 },
            { field: 'assignee', op: 'empty' },
          ],
        },
      ],
    };
    expect(passes(open)).toBe(true);
    expect(passes(open, triage)).toBe(true);
    expect(passes(open, { ...fix, status: 'shipped' })).toBe(false);
    expect(passes({ all: [] })).toBe(true);
    expect(passes({ any: [] })).toBe(false);
  });

  it('reads a path through the option a row holds, to what it means', () => {
    const unfinished: Filter = { field: 'status.kind', op: 'in', value: ['todo', 'active'] };
    expect(passes(unfinished)).toBe(true);
    expect(passes(unfinished, { ...fix, status: 'shipped' })).toBe(false);
    // an option without the attribute, or no option, is empty there
    expect(passes({ field: 'status.kind', op: 'empty' }, triage)).toBe(true);
    expect(passes({ field: 'status.kind', op: 'empty' }, { ...fix, status: null })).toBe(true);
    expect(passes({ field: 'status.kind', op: 'notEquals', value: 'done' }, triage)).toBe(true);
  });

  it('reads a path on a many field through each option it holds', () => {
    expect(passes({ field: 'labels.team', op: 'in', value: ['core'] })).toBe(true);
    expect(passes({ field: 'labels.team', op: 'notIn', value: ['core'] })).toBe(false);
    expect(passes({ field: 'labels.team', op: 'empty' }, { ...fix, labels: ['docs'] })).toBe(true);
  });

  it('reads a path one key into an object value, as a template’s repeat shows one entry', () => {
    const entry: Row = { ...fix, services: { name: 'web', state: 'running' } };
    expect(passes({ field: 'services.state', op: 'equals', value: 'running' }, entry)).toBe(true);
    expect(passes({ field: 'services.name', op: 'in', value: ['api', 'db'] }, entry)).toBe(false);
    expect(passes({ field: 'services.port', op: 'empty' }, entry)).toBe(true);
    // the whole list is no entry: its keys aren't read through it
    expect(passes({ field: 'services.name', op: 'empty' })).toBe(true);
  });

  it('holds isMe for the viewer, and for no row when no one is signed in', () => {
    const mine: Filter = { field: 'assignee', op: 'isMe' };
    expect(passes(mine, fix, 3)).toBe(true);
    expect(passes(mine, fix, 4)).toBe(false);
    expect(passes(mine, fix)).toBe(false);
  });

  it('reads a key a row doesn’t carry as no value', () => {
    expect(passes({ field: 'title', op: 'empty' }, { id: 7 })).toBe(true);
  });

  it('runs an app’s own operator as bh’s', () => {
    const odd: OperatorSpec = {
      name: 'odd',
      label: 'is odd',
      matches: (a) => typeof a === 'number' && a % 2 === 1,
    };
    const own = createRegistry({ operators: baseOperators.register({ odd }) });
    expect(matchesFilter({ field: 'id', op: 'odd' }, fix, items, own)).toBe(true);
  });

  it('throws on an operator nothing registered', () => {
    expect(() => passes({ field: 'id', op: 'odd' })).toThrow('No operator is registered as "odd".');
  });

  it('agrees with queryOf: a filter it takes runs', () => {
    const filter: Filter = {
      all: [
        { field: 'status.kind', op: 'in', value: ['active'] },
        { field: 'labels', op: 'in', value: ['ui'] },
        { field: 'assignee', op: 'isMe' },
      ],
    };
    expect(v.is(queryOf(items, registry), { filter })).toBe(true);
    expect(passes(filter, fix, 3)).toBe(true);
  });
});

describe('matchesSearch', () => {
  // title and notes are searched, a rich text by its words; status is not.
  const searched: ResourceMeta = {
    ...items,
    fields: [
      ...items.fields.map((each) => {
        return each.key === 'title' ? { ...each, query: { ...each.query, search: true } } : each;
      }),
      {
        ...field('aliases', { kind: 'text', many: true }, []),
        query: { filter: [], sort: false, group: false, search: true },
      },
      {
        ...field('notes', { kind: 'richtext' }, []),
        query: { filter: [], sort: false, group: false, search: true },
      },
    ],
  };
  const notes = JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Session cookie expires' }] }],
  });
  const row: Row = { ...fix, aliases: ['SSO', 'sign-in'], notes };
  const finds = (term: string) => matchesSearch(term, row, searched, registry);

  it('keeps a row where a searched field holds the term, case ignored', () => {
    expect(finds('LOGIN')).toBe(true);
    expect(finds('fix the')).toBe(true);
  });

  it('matches the term whole, as one piece of text', () => {
    expect(finds('login fix')).toBe(false);
  });

  it('looks in each value of a list, and in a rich text’s words, never its JSON', () => {
    expect(finds('sign-in')).toBe(true);
    expect(finds('cookie exp')).toBe(true);
    expect(finds('paragraph')).toBe(false);
  });

  it('looks in no field a search doesn’t', () => {
    expect(finds('doing')).toBe(false);
    expect(matchesSearch('login', fix, items, registry)).toBe(false);
  });
});
