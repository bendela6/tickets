import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { issuesOf } from '@bh/resource';
import { columnsOf, resolveState, ViewState, ViewStates } from './state';
import { View, type ItemView, type TableView } from './view';

// A table of four columns, the last hidden until a reader shows it; and the
// same items as cards, grouped. A reader's state of each, and what each opens
// with once the state is laid over its definition.

const table = v.parse(View, {
  key: 'open',
  label: 'Open items',
  resource: 'items',
  host: 'table',
  columns: [
    {
      fixed: { key: 'name', label: 'Name', width: { mode: 'fill', min: 240 } },
      template: { field: 'title' },
    },
    {
      fixed: {
        key: 'status',
        label: 'Status',
        width: { mode: 'fixed', size: 140, min: 96, max: 320 },
      },
      template: { field: 'status' },
    },
    { fixed: { key: 'owner', label: 'Owner' }, template: { field: 'owner' } },
    { fixed: { key: 'due', label: 'Due', hidden: true }, template: { field: 'due' } },
  ],
  sort: [{ field: 'priority', dir: 'asc' }],
}) as TableView;

const board = v.parse(View, {
  key: 'board',
  label: 'Board',
  resource: 'items',
  host: 'cards',
  item: { fixed: {}, template: { field: 'title' } },
  group: { field: 'status', all: true },
}) as ItemView;

const state = {
  columns: [{ key: 'status' }, { key: 'due', hidden: false }, { key: 'name', hidden: true }],
  widths: { status: 180, name: 320 },
  sort: [{ field: 'due', dir: 'desc' }],
  filters: { search: 'login', filter: { all: [{ field: 'owner', op: 'isMe' }] } },
  collapsed: ['done', null, 3, true],
};

/** What a schema refuses in a state, each problem by its path. */
function refusals(input: unknown, schema: v.GenericSchema = ViewState) {
  const result = v.safeParse(schema, input);
  return result.success ? [] : issuesOf(result.issues);
}

describe('a view’s state', () => {
  it('parses, every part of it, and none', () => {
    expect(v.parse(ViewState, state)).toEqual(state);
    expect(v.parse(ViewState, {})).toEqual({});
  });

  it('is JSON: stored, read back and checked again, it is the same state', () => {
    const stored = JSON.parse(JSON.stringify(v.parse(ViewState, state))) as unknown;
    expect(v.parse(ViewState, stored)).toEqual(state);
  });

  it('is stored per view, by the view’s key', () => {
    const states = { open: state, board: { collapsed: ['done'] } };
    expect(v.parse(ViewStates, states)).toEqual(states);
    expect(refusals({ open: { columns: 'status' } }, ViewStates)).toEqual([
      { path: ['open', 'columns'], message: expect.stringMatching(/Array/) as unknown },
    ]);
    expect(refusals([state], ViewStates)).toEqual([
      { path: [], message: 'a reader’s states are by view key: { "open": {} }' },
    ]);
  });
});

describe('a wrong state is refused, at its path', () => {
  it.each([
    ['a part no state has', { pinned: ['name'] }, ['pinned'], /never/],
    ['a column by no key', { columns: [{ hidden: true }] }, ['columns', 0, 'key'], /"key"/],
    [
      'a column by an empty key',
      { columns: [{ key: '' }] },
      ['columns', 0, 'key'],
      /named by its key/,
    ],
    [
      'a column placed twice',
      { columns: [{ key: 'name' }, { key: 'status' }, { key: 'name', hidden: true }] },
      ['columns', 2, 'key'],
      /the column "name" is placed twice/,
    ],
    [
      'a column with a width beside it',
      { columns: [{ key: 'name', width: 90 }] },
      ['columns', 0, 'width'],
      /never/,
    ],
    ['widths as a list', { widths: [180] }, ['widths'], /pixels by column key/],
    ['a width of no pixels', { widths: { status: 0 } }, ['widths', 'status'], /more than 0 pixels/],
    ['a width as text', { widths: { status: '180px' } }, ['widths', 'status'], /number/],
    ['a sort by a column', { sort: 'due' }, ['sort'], /Array/],
    [
      'a sort sideways',
      { sort: [{ field: 'due', dir: 'up' }] },
      ['sort', 0, 'dir'],
      /"asc" \| "desc"/,
    ],
    [
      'a search of nothing',
      { filters: { search: '' } },
      ['filters', 'search'],
      /at least one character/,
    ],
    ['filters holding a sort', { filters: { sort: [] } }, ['filters', 'sort'], /never/],
    [
      'a filter that is no filter',
      { filters: { filter: { field: 'owner' } } },
      ['filters', 'filter', 'op'],
      /"op"/,
    ],
    ['a group collapsed twice', { collapsed: ['done', 'done'] }, ['collapsed'], /collapsed once/],
    [
      'a group by an object',
      { collapsed: [{ key: 'done' }] },
      ['collapsed', 0],
      /string|number|boolean|null/i,
    ],
  ])('%s', (_what, input, path, message) => {
    const found = refusals(input);
    expect(found.map((issue) => issue.path)).toEqual([path]);
    expect(found[0]?.message).toMatch(message);
  });

  it('tells a group of 1 from a group of "1"', () => {
    expect(refusals({ collapsed: [1, '1', true, 'true', null, 'null'] })).toEqual([]);
  });
});

describe('resolveState', () => {
  it('opens a view as its definition sets it when no state is stored', () => {
    expect(resolveState(table)).toEqual({
      columns: [
        { key: 'name', hidden: false },
        { key: 'status', hidden: false },
        { key: 'owner', hidden: false },
        { key: 'due', hidden: true },
      ],
      widths: {},
      sort: [{ field: 'priority', dir: 'asc' }],
      collapsed: [],
    });
  });

  it('lays the reader’s state over it: their order first, then the rest in the view’s', () => {
    const opened = resolveState(table, v.parse(ViewState, state));
    expect(opened.columns).toEqual([
      { key: 'status', hidden: false },
      { key: 'due', hidden: false },
      { key: 'name', hidden: true },
      { key: 'owner', hidden: false },
    ]);
    expect(opened.widths).toEqual({ status: 180, name: 320 });
    expect(opened.sort).toEqual([{ field: 'due', dir: 'desc' }]);
    expect(opened.filters).toEqual(state.filters);
  });

  it('keeps a column’s hidden as the view sets it when the reader didn’t say', () => {
    const opened = resolveState(table, { columns: [{ key: 'due' }, { key: 'name' }] });
    expect(opened.columns.slice(0, 2)).toEqual([
      { key: 'due', hidden: true },
      { key: 'name', hidden: false },
    ]);
  });

  it('passes over a column, and its width, the view no longer has', () => {
    const opened = resolveState(table, {
      columns: [{ key: 'estimate' }, { key: 'owner' }],
      widths: { estimate: 90, owner: 200 },
    });
    expect(opened.columns.map((column) => column.key)).toEqual(['owner', 'name', 'status', 'due']);
    expect(opened.widths).toEqual({ owner: 200 });
  });

  it('keeps a dragged width within its column’s bounds', () => {
    expect(resolveState(table, { widths: { status: 40, name: 100 } }).widths).toEqual({
      status: 96,
      name: 240,
    });
    expect(resolveState(table, { widths: { status: 900 } }).widths).toEqual({ status: 320 });
  });

  it('takes an empty sort as the resource’s own order, and empty filters as none', () => {
    const opened = resolveState(table, { sort: [], filters: {} });
    expect(opened.sort).toEqual([]);
    expect(opened.filters).toEqual({});
  });

  it('leaves the filters out when the reader set none, for the view’s own to open with', () => {
    expect(resolveState(table, { sort: [] })).not.toHaveProperty('filters');
  });

  it('collapses groups only in a view that groups', () => {
    expect(resolveState(board, { collapsed: ['done'] }).collapsed).toEqual(['done']);
    expect(resolveState(table, { collapsed: ['done'] }).collapsed).toEqual([]);
  });

  it('has no columns for cards, whatever the state names', () => {
    const opened = resolveState(board, { columns: [{ key: 'name' }], widths: { name: 200 } });
    expect(opened.columns).toEqual([]);
    expect(opened.widths).toEqual({});
    expect(opened.sort).toEqual([]);
  });
});

describe('columnsOf', () => {
  it('gives a table’s columns in the reader’s order, each one’s hidden set', () => {
    const columns = columnsOf(table, {
      columns: [
        { key: 'due', hidden: false },
        { key: 'name', hidden: true },
      ],
    });
    expect(columns.map((column) => [column.fixed.key, column.fixed.hidden])).toEqual([
      ['due', false],
      ['name', true],
      ['status', false],
      ['owner', false],
    ]);
    expect(columns[0]?.template).toEqual({ field: 'due' });
    expect(table.columns[3]?.fixed.hidden).toBe(true);
  });

  it('gives them as the view sets them with no state', () => {
    expect(columnsOf(table).map((column) => column.fixed.key)).toEqual([
      'name',
      'status',
      'owner',
      'due',
    ]);
  });
});
