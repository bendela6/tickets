import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { baseOperators, createRegistry, issuesOf, type OperatorSpec } from '@bh/resource';
import {
  Column,
  ColumnFixed,
  columnHost,
  columnOf,
  FilterControl,
  type ColumnRegistry,
} from './column';

// A list's columns, as a view registers them: a key and title, a status with a
// filter in its header, a due date filtered by a range, a size at the end.

const title = {
  fixed: { key: 'title', label: 'Title' },
  template: { field: 'title' },
};

const name = {
  fixed: {
    key: 'name',
    label: 'Name',
    width: { mode: 'fill', min: 240 },
    pinned: 'start',
    sort: ['project', 'number'],
    filter: { field: 'title', op: 'contains', control: 'text' },
  },
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
    width: { mode: 'fixed', size: 140, min: 96, max: 240 },
    sort: 'status',
    filter: {
      field: 'status.kind',
      op: 'in',
      control: 'toggle-chips',
      default: ['active', 'waiting'],
    },
  },
  template: { field: 'status', renderer: 'pill' },
};

const due = {
  fixed: {
    key: 'due',
    label: 'Due',
    width: { mode: 'auto', max: 160 },
    align: 'end',
    sort: 'due',
    filter: {
      field: 'due',
      range: ['gte', 'lte'],
      control: 'date-range',
      default: ['2026-10-01', null],
    },
    hidden: true,
  },
  template: { field: 'due', when: { field: 'due', op: 'notEmpty' } },
};

const created = {
  fixed: {
    key: 'created',
    label: 'Created',
    sort: 'createdAt',
    filter: {
      field: 'createdAt',
      op: 'inLast',
      control: 'segmented',
      config: { placeholder: 'Any' },
      map: { today: 1, week: 7, month: 30, any: null },
      default: 'week',
    },
  },
  template: { field: 'createdAt' },
};

/** An object with `changes` made: each key replaced, or taken out when undefined. */
function changed(object: object, changes: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({ ...object, ...changes }).filter(([, value]) => value !== undefined),
  );
}

/** The status column with its fixed parts changed. */
function withFixed(changes: Record<string, unknown>) {
  return { ...status, fixed: changed(status.fixed, changes) };
}

/** The status column with its filter changed. */
function withFilter(changes: Record<string, unknown>) {
  return withFixed({ filter: changed(status.fixed.filter, changes) });
}

/** What a schema refuses in a column, each problem by its path. */
function refusals(input: unknown, schema = Column) {
  const result = v.safeParse(schema, input);
  return result.success ? [] : issuesOf(result.issues);
}

describe('a column', () => {
  it.each([
    ['one field', title],
    ['a fill width, pinned, sorting by two fields, a text filter', name],
    ['a fixed width within its bounds, a filter starting on two options', status],
    ['an auto width, a range filter half open, hidden at first', due],
    ['a filter whose control’s values map to operands, with its config', created],
  ])('parses with %s', (_what, column) => {
    expect(v.parse(Column, column)).toEqual(column);
    expect(v.parse(columnOf(), column)).toEqual(column);
  });

  it('is JSON: stored, read back and checked again, it is the same column', () => {
    for (const column of [title, name, status, due, created]) {
      const stored = JSON.parse(JSON.stringify(v.parse(Column, column))) as unknown;
      expect(v.parse(Column, stored)).toEqual(column);
    }
  });

  it('is a host: its fixed parts are its host’s, its cell the template', () => {
    expect(v.is(columnHost.fixed, status.fixed)).toBe(true);
    expect(columnHost.fixed).toBe(ColumnFixed);
    // The header draws its label, the filter row its control, each row its cell.
    expect(columnHost.order).toEqual(['label', 'filter', 'template']);
  });

  it('names the FilterForm design’s inputs that filter one field', () => {
    expect(FilterControl.options).toEqual([
      'select',
      'multi-select',
      'segmented',
      'checkbox',
      'toggle',
      'text',
      'number',
      'date',
      'date-range',
      'user',
      'toggle-chips',
      'tabs',
      'avatars',
    ]);
  });
});

describe('a wrong column is refused, at its path', () => {
  it.each([
    ['no key', withFixed({ key: undefined }), ['fixed', 'key'], /"key"/],
    ['an empty key', withFixed({ key: '' }), ['fixed', 'key'], /named by its key/],
    ['an empty label', withFixed({ label: '' }), ['fixed', 'label'], /header says/],
    ['a part no column has', withFixed({ header: 'Status' }), ['fixed', 'header'], /never/],
    [
      'a width in no mode',
      withFixed({ width: { size: 140 } }),
      ['fixed', 'width', 'mode'],
      /fixed, fill or auto/,
    ],
    [
      'a width in another mode',
      withFixed({ width: { mode: 'grow' } }),
      ['fixed', 'width', 'mode'],
      /fixed, fill or auto/,
    ],
    ['a width as CSS', withFixed({ width: '140px' }), ['fixed', 'width'], /fixed, fill or auto/],
    [
      'a fixed width with no size',
      withFixed({ width: { mode: 'fixed' } }),
      ['fixed', 'width', 'size'],
      /"size"/,
    ],
    [
      'a width of 0',
      withFixed({ width: { mode: 'fixed', size: 0 } }),
      ['fixed', 'width', 'size'],
      /more than 0/,
    ],
    [
      'a fill with a size',
      withFixed({ width: { mode: 'fill', size: 140 } }),
      ['fixed', 'width', 'size'],
      /never/,
    ],
    [
      'a max under the min',
      withFixed({ width: { mode: 'auto', min: 200, max: 100 } }),
      ['fixed', 'width', 'max'],
      /no less than its min/,
    ],
    [
      'a fixed size past its max',
      withFixed({ width: { mode: 'fixed', size: 300, max: 240 } }),
      ['fixed', 'width', 'size'],
      /within its min and max/,
    ],
    [
      'a fixed size under its min',
      withFixed({ width: { mode: 'fixed', size: 60, min: 96 } }),
      ['fixed', 'width', 'size'],
      /within its min and max/,
    ],
    [
      'an align of left',
      withFixed({ align: 'left' }),
      ['fixed', 'align'],
      /start, its center or its end/,
    ],
    ['pinned right', withFixed({ pinned: 'right' }), ['fixed', 'pinned'], /start or its end/],
    [
      'a sort two levels deep',
      withFixed({ sort: 'status.kind.name' }),
      ['fixed', 'sort'],
      /a dot and one of its attributes/,
    ],
    ['a sort by no field', withFixed({ sort: [] }), ['fixed', 'sort'], /one field or more/],
    [
      'a sort by a field twice',
      withFixed({ sort: ['status', 'status'] }),
      ['fixed', 'sort'],
      /each field once/,
    ],
    [
      'a sort by a path too deep',
      withFixed({ sort: ['status', 'status.kind.name'] }),
      ['fixed', 'sort', 1],
      /a dot and one of its attributes/,
    ],
    [
      'a sort that is a query’s',
      withFixed({ sort: [{ field: 'status', dir: 'asc' }] }),
      ['fixed', 'sort', 0],
      /string/,
    ],
    ['hidden as a word', withFixed({ hidden: 'yes' }), ['fixed', 'hidden'], /boolean/],
    [
      'a filter on no field',
      withFilter({ field: undefined }),
      ['fixed', 'filter', 'field'],
      /"field"/,
    ],
    [
      'a filter with no operator',
      withFilter({ op: '' }),
      ['fixed', 'filter', 'op'],
      /names its operator/,
    ],
    [
      'a filter with no control',
      withFilter({ control: undefined }),
      ['fixed', 'filter', 'control'],
      /"control"/,
    ],
    [
      'a filter drawn by search',
      withFilter({ control: 'search' }),
      ['fixed', 'filter', 'control'],
      /operand/,
    ],
    [
      'a filter drawn by rules',
      withFilter({ control: 'rules' }),
      ['fixed', 'filter', 'control'],
      /operand/,
    ],
    [
      'a condition drawn by a date-range',
      withFilter({ control: 'date-range' }),
      ['fixed', 'filter', 'control'],
      /date-range filters a range/,
    ],
    [
      'a default that is an object',
      withFilter({ default: { kind: 'active' } }),
      ['fixed', 'filter', 'default'],
      /a value, or a list/,
    ],
    [
      'a default holding null',
      withFilter({ default: ['active', null] }),
      ['fixed', 'filter', 'default'],
      /a value, or a list/,
    ],
    [
      'a range drawn by a select',
      withFixed({ filter: { ...due.fixed.filter, control: 'select' } }),
      ['fixed', 'filter', 'control'],
      /drawn by a date-range/,
    ],
    [
      'a range of one operator',
      withFixed({ filter: { ...due.fixed.filter, range: ['gte'] } }),
      ['fixed', 'filter', 'range', 1],
      /string/,
    ],
    [
      'a range beside an operator',
      withFixed({ filter: { ...due.fixed.filter, op: 'gte' } }),
      ['fixed', 'filter', 'op'],
      /never/,
    ],
    [
      'a range’s default of one half',
      withFixed({ filter: { ...due.fixed.filter, default: ['2026-10-01'] } }),
      ['fixed', 'filter', 'default', 1],
      /Invalid type/,
    ],
    [
      'a map to an object',
      withFilter({ map: { mine: { field: 'owner' } } }),
      ['fixed', 'filter', 'map', 'mine'],
      /a value, or a list/,
    ],
    [
      'a map that is a list',
      withFilter({ map: [['mine', 1]] }),
      ['fixed', 'filter', 'map'],
      /turns a value, by its text/,
    ],
    [
      'a range with a map',
      withFixed({ filter: { ...due.fixed.filter, map: { week: 7 } } }),
      ['fixed', 'filter', 'map'],
      /never/,
    ],
    [
      'a config that is text',
      withFilter({ config: 'Any' }),
      ['fixed', 'filter', 'config'],
      /config is a JSON object/,
    ],
    [
      'a config that is a list',
      withFilter({ config: ['Any'] }),
      ['fixed', 'filter', 'config'],
      /config is a JSON object/,
    ],
    [
      'a cell that is a list of parts',
      { ...status, template: [{ field: 'status' }] },
      ['template'],
      /JSON object/,
    ],
    [
      'a config holding a function',
      withFilter({ config: { format: () => 'x' } }),
      ['fixed', 'filter', 'config', 'format'],
      /type/,
    ],
    ['no cell', { fixed: status.fixed }, ['template'], /"template"/],
    [
      'a cell that is a field’s key',
      { ...status, template: 'status' },
      ['template'],
      /JSON object/,
    ],
    ['an empty cell', { ...status, template: {} }, ['template'], /a part showing a field/],
    [
      'a cell showing two things',
      { ...status, template: { field: 'status', text: '{status}' } },
      ['template'],
      /a part showing a field/,
    ],
    [
      'a layout holding no nodes',
      { ...status, template: { layout: 'row' } },
      ['template'],
      /a layout node holding nodes/,
    ],
    [
      'a cell holding a function',
      { ...status, template: { field: 'status', options: { tone: () => 'blue' } } },
      ['template', 'options'],
      /type/,
    ],
    ['a cell beside the fixed parts', { ...status, cell: { field: 'status' } }, ['cell'], /never/],
  ])('%s', (_what, column, path, message) => {
    const found = refusals(column);
    expect(found.map((issue) => issue.path)).toEqual([path]);
    expect(found[0]?.message).toMatch(message);
  });

  it('reports each problem, every one at its own path', () => {
    const column = withFixed({
      label: '',
      width: { mode: 'auto', min: 200, max: 100 },
      filter: { ...status.fixed.filter, control: 'search' },
    });
    expect(refusals(column).map((issue) => issue.path)).toEqual([
      ['fixed', 'label'],
      ['fixed', 'width', 'max'],
      ['fixed', 'filter', 'control'],
    ]);
  });
});

describe('columnOf', () => {
  const between: OperatorSpec = {
    name: 'between',
    label: 'is between',
    matches: () => true,
  };

  it('takes an operator any registry holds, bh’s fifteen when none is given', () => {
    expect(refusals(status, columnOf())).toEqual([]);
    expect(refusals(due, columnOf())).toEqual([]);
  });

  it('refuses an operator none registers, by its name, where the filter names it', () => {
    const condition = withFilter({ op: 'between' });
    expect(refusals(condition)).toEqual([]);
    expect(refusals(condition, columnOf())).toEqual([
      { path: ['fixed', 'filter', 'op'], message: 'no operator "between"' },
    ]);
    const range = withFixed({ filter: { ...due.fixed.filter, range: ['gte', 'before'] } });
    expect(refusals(range, columnOf())).toEqual([
      { path: ['fixed', 'filter', 'range', 1], message: 'no operator "before"' },
    ]);
  });

  it('takes an app’s own operator from its registry', () => {
    const condition = withFilter({ op: 'between' });
    expect(
      refusals(
        condition,
        columnOf(createRegistry({ operators: baseOperators.register({ between }) })),
      ),
    ).toEqual([]);
    const operators: ColumnRegistry = { operators: { has: (name) => name === 'in' } };
    expect(refusals(status, columnOf(operators))).toEqual([]);
    expect(refusals(withFilter({ op: 'notIn' }), columnOf(operators))).toEqual([
      { path: ['fixed', 'filter', 'op'], message: 'no operator "notIn"' },
    ]);
  });
});
