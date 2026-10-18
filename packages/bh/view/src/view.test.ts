import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { baseOperators, createRegistry, issuesOf, type OperatorSpec } from '@bh/resource';
import { View, viewOf } from './view';

// Three views of one resource: a table of open items with its filters, sort,
// grouping, page size and density; the same items as cards, grouped into a
// board; and a list with nothing but its item.

const name = {
  fixed: { key: 'name', label: 'Name', width: { mode: 'fill', min: 240 }, sort: 'title' },
  template: {
    layout: 'row',
    options: { gap: 2 },
    nodes: [{ text: '{project}-{number}', options: { mono: true } }, { field: 'title' }],
  },
};

const status = {
  fixed: {
    key: 'status',
    label: 'Status',
    sort: 'status',
    filter: { field: 'status.kind', op: 'in', control: 'toggle-chips' },
  },
  template: { field: 'status' },
};

const form = {
  commit: 'change',
  nodes: [
    {
      kind: 'inline',
      props: { overflow: 'wrap' },
      children: [
        { kind: 'field', name: 'search', type: 'search', config: { placeholder: 'Search' } },
        { kind: 'field', name: 'rules', type: 'rules', config: {}, filter: { rules: true } },
      ],
    },
  ],
};

const table = {
  key: 'open',
  label: 'Open items',
  resource: 'items',
  host: 'table',
  columns: [name, status],
  filters: {
    form,
    default: {
      filter: { all: [{ field: 'status.kind', op: 'in', value: ['todo', 'active'] }] },
    },
  },
  sort: [{ field: 'priority', dir: 'asc' }],
  group: { field: 'status.kind', all: true },
  pageSize: 50,
  density: 'compact',
};

const board = {
  key: 'board',
  label: 'Board',
  resource: 'items',
  host: 'cards',
  item: {
    fixed: { icon: 'square', title: 'Item' },
    template: {
      layout: 'stack',
      options: { gap: 1 },
      nodes: [{ field: 'title' }, { field: 'assignee', renderer: 'user' }],
    },
  },
  group: { field: 'status', all: true },
};

const list = {
  key: 'recent',
  label: 'Recent',
  resource: 'items',
  host: 'list',
  item: { fixed: {}, template: { field: 'title' } },
};

/** A view with `changes` made: each key replaced, or taken out when undefined. */
function changed(view: object, changes: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({ ...view, ...changes }).filter(([, value]) => value !== undefined),
  );
}

/** What a schema refuses in a view, each problem by its path. */
function refusals(input: unknown, schema = View) {
  const result = v.safeParse(schema, input);
  return result.success ? [] : issuesOf(result.issues);
}

describe('a view', () => {
  it.each([
    ['a table, with filters, sort, grouping, page size and density', table],
    ['cards grouped into a board', board],
    ['a list with its item alone', list],
  ])('parses as %s', (_what, view) => {
    expect(v.parse(View, view)).toEqual(view);
    expect(v.parse(viewOf(), view)).toEqual(view);
  });

  it('is JSON: stored, read back and checked again, it is the same view', () => {
    for (const view of [table, board, list]) {
      const stored = JSON.parse(JSON.stringify(v.parse(View, view))) as unknown;
      expect(v.parse(View, stored)).toEqual(view);
    }
  });

  it('takes tiles as a host, as it takes a list and cards', () => {
    expect(refusals({ ...list, host: 'tiles' })).toEqual([]);
  });
});

describe('a wrong view is refused, at its path', () => {
  it.each([
    ['no key', changed(table, { key: undefined }), ['key'], /"key"/],
    ['an empty label', changed(table, { label: '' }), ['label'], /says what it shows/],
    [
      'a resource that is no word',
      changed(table, { resource: 'open items' }),
      ['resource'],
      /a word/,
    ],
    [
      'a host there is none of',
      changed(table, { host: 'board' }),
      ['host'],
      /a table, a list, tiles or cards/,
    ],
    ['a part no view has', changed(list, { mode: 'list' }), ['mode'], /never/],
    ['a table with no columns', changed(table, { columns: [] }), ['columns'], /one column or more/],
    [
      'a table without its columns',
      changed(table, { columns: undefined }),
      ['columns'],
      /"columns"/,
    ],
    [
      'a table with an item beside its columns',
      changed(table, { item: list.item }),
      ['item'],
      /never/,
    ],
    [
      'two columns of one key',
      changed(table, { columns: [name, status, { ...status, template: { field: 'state' } }] }),
      ['columns', 2, 'fixed', 'key'],
      /two columns are "status"/,
    ],
    [
      'a column in no width mode',
      changed(table, { columns: [{ ...name, fixed: { ...name.fixed, width: { size: 9 } } }] }),
      ['columns', 0, 'fixed', 'width', 'mode'],
      /fixed, fill or auto/,
    ],
    ['cards without their item', changed(board, { item: undefined }), ['item'], /"item"/],
    [
      'cards with columns beside their item',
      changed(board, { columns: [name] }),
      ['columns'],
      /never/,
    ],
    [
      'an item’s fixed parts as a list',
      changed(list, { item: { fixed: [], template: { field: 'title' } } }),
      ['item', 'fixed'],
      /JSON object/,
    ],
    [
      'an item’s empty template',
      changed(list, { item: { fixed: {}, template: {} } }),
      ['item', 'template'],
      /a part showing a field/,
    ],
    [
      'filters with no form',
      changed(table, { filters: { default: {} } }),
      ['filters', 'form'],
      /"form"/,
    ],
    [
      'a form with no nodes',
      changed(table, { filters: { form: { commit: 'change' } } }),
      ['filters', 'form', 'nodes'],
      /nodes/,
    ],
    [
      'a form’s node that is text',
      changed(table, { filters: { form: { nodes: ['search'] } } }),
      ['filters', 'form', 'nodes', 0],
      /node is a JSON object/,
    ],
    [
      'a form holding a function',
      changed(table, { filters: { form: { ...form, schema: () => true } } }),
      ['filters', 'form', 'schema'],
      /type/,
    ],
    [
      'a default search of nothing',
      changed(table, { filters: { form, default: { search: '' } } }),
      ['filters', 'default', 'search'],
      /at least one character/,
    ],
    [
      'a default filter that is no filter',
      changed(table, { filters: { form, default: { filter: { all: [{ field: 'status' }] } } } }),
      ['filters', 'default', 'filter', 'all', 0, 'op'],
      /"op"/,
    ],
    [
      'a default holding a sort',
      changed(table, { filters: { form, default: { sort: [] } } }),
      ['filters', 'default', 'sort'],
      /never/,
    ],
    [
      'a sort upward',
      changed(table, { sort: [{ field: 'priority', dir: 'up' }] }),
      ['sort', 0, 'dir'],
      /"asc" \| "desc"/,
    ],
    ['a sort by a column', changed(table, { sort: 'priority' }), ['sort'], /Array/],
    [
      'grouping two levels deep',
      changed(table, { group: { field: 'status.kind.name' } }),
      ['group', 'field'],
      /a dot and one of its attributes/,
    ],
    ['a page of no rows', changed(table, { pageSize: 0 }), ['pageSize'], /at least one row/],
    ['a page of 501 rows', changed(table, { pageSize: 501 }), ['pageSize'], /at most 500/],
    ['a page of half a row', changed(table, { pageSize: 2.5 }), ['pageSize'], /whole rows/],
    [
      'a density there is none of',
      changed(table, { density: 'cozy' }),
      ['density'],
      /comfortable or compact/,
    ],
  ])('%s', (_what, view, path, message) => {
    const found = refusals(view);
    expect(found.map((issue) => issue.path)).toEqual([path]);
    expect(found[0]?.message).toMatch(message);
  });
});

describe('viewOf', () => {
  const between: OperatorSpec = { name: 'between', label: 'is between', matches: () => true };
  const betweenColumn = {
    ...status,
    fixed: { ...status.fixed, filter: { ...status.fixed.filter, op: 'between' } },
  };

  it('refuses a column’s operator no registry holds, where its filter names it', () => {
    const view = changed(table, { columns: [name, betweenColumn] });
    expect(refusals(view)).toEqual([]);
    expect(refusals(view, viewOf())).toEqual([
      { path: ['columns', 1, 'fixed', 'filter', 'op'], message: 'no operator "between"' },
    ]);
    expect(
      refusals(view, viewOf(createRegistry({ operators: baseOperators.register({ between }) }))),
    ).toEqual([]);
  });
});
