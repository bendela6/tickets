import { createRegistry, metaOf, type FieldMeta } from '@bh/resource';
import { describe, expect, it, vi } from 'vitest';
import type { FieldFilter } from '../types/field-filter';
import type { FormConfig } from '../types/form-config';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { fillFilterForm, type FilterMeta, type FilterOption } from './meta';
import { kinds, operators, tasks } from './meta.fixture';

type Config = FormConfig<InputRegistry, LayoutComponentRegistry>;

const source: FilterMeta = { meta: tasks, operators, kinds };

/** A form of one field, in a row, as a filter bar holds its fields. */
function one(
  filter: FieldFilter,
  config: Record<string, unknown> = {},
  label?: string,
  name = 'field',
): Config {
  return {
    nodes: [
      {
        kind: 'inline',
        props: {},
        children: [
          { kind: 'field', name, type: 'select', config, filter, ...(label ? { label } : {}) },
        ],
      },
    ],
  };
}

/** The one field of a filled form. */
function filled(form: Config, state = {}, given: FilterMeta = source) {
  const row = fillFilterForm(form, given, state).nodes[0] as { children: unknown[] };
  return row.children[0] as { label?: string; config: Record<string, unknown> };
}

describe('the made-up resource', () => {
  it('is metadata the resource contract accepts', () => {
    const result = metaOf(createRegistry())['~standard'].validate(tasks);
    expect(result).not.toBeInstanceOf(Promise);
    expect((result as { issues?: unknown }).issues).toBeUndefined();
  });
});

describe('fillFilterForm', () => {
  it('names a field by its field’s label, unless the config does', () => {
    expect(filled(one({ op: 'in', field: 'status' })).label).toBe('Status');
    expect(filled(one({ op: 'in', field: 'status' }, {}, 'State')).label).toBe('State');
    // By its own name when its filter names no field.
    expect(filled(one({ op: 'equals' }, {}, undefined, 'pinned')).label).toBe('Pinned');
  });

  it('offers an option field’s options in their order, with their colors, archived ones left out', () => {
    expect(filled(one({ op: 'in', field: 'status' })).config.options).toEqual([
      { value: 'open', label: 'Open', color: 'blue' },
      { value: 'review', label: 'Review' },
      { value: 'done', label: 'Done', color: 'success' },
    ]);
  });

  it('keeps an archived option the value holds', () => {
    const { options } = filled(one({ op: 'in', field: 'status' }), {
      values: { field: ['parked'] },
    }).config;
    expect((options as FilterOption[]).map((option) => option.value)).toEqual([
      'open',
      'review',
      'done',
      'parked',
    ]);
  });

  it('offers an option attribute’s options for a path', () => {
    expect(filled(one({ op: 'in', field: 'status.kind' })).config.options).toEqual([
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ]);
  });

  it('loads a ref field’s rows through optionsFor, as async config', async () => {
    const rows = [{ value: 'u1', label: 'Ana' }];
    const optionsFor = vi.fn(() => Promise.resolve(rows));
    const { options } = filled(one({ op: 'in', field: 'assignee' }), {}, { ...source, optionsFor })
      .config as { options: { fn: () => Promise<FilterOption[]>; dependsOn: string[] } };
    expect(options.dependsOn).toEqual([]);
    await expect(options.fn()).resolves.toBe(rows);
    expect(optionsFor).toHaveBeenCalledWith('users', '');
  });

  it('offers a map’s keys when the field has no options', () => {
    const map = { yes: true, no: false, any: null };
    expect(filled(one({ op: 'equals', field: 'pinned', map })).config.options).toEqual([
      { value: 'yes', label: 'yes' },
      { value: 'no', label: 'no' },
      { value: 'any', label: 'any' },
    ]);
  });

  it('offers a presets field its presets', () => {
    const presets = [
      { value: 'mine', label: 'Mine', filter: { field: 'assignee', op: 'isMe' } },
      { value: 'recent', label: 'Recent', filter: { field: 'updatedAt', op: 'inLast', value: 7 } },
    ];
    expect(filled(one({ presets })).config.options).toEqual([
      { value: 'mine', label: 'Mine' },
      { value: 'recent', label: 'Recent' },
    ]);
  });

  it('keeps the options its config gives', () => {
    const options = [{ value: 'open', label: 'Still open' }];
    expect(filled(one({ op: 'in', field: 'status' }, { options })).config.options).toBe(options);
  });

  it('puts the counts on the options of a field whose config asks for them, 0 for one left out', () => {
    const state = { counts: { field: { open: 12, done: 0 } } };
    expect(
      filled(one({ op: 'in', field: 'status' }, { counts: true }), state).config.options,
    ).toEqual([
      { value: 'open', label: 'Open', color: 'blue', count: 12 },
      { value: 'review', label: 'Review', count: 0 },
      { value: 'done', label: 'Done', color: 'success', count: 0 },
    ]);
    expect(filled(one({ op: 'in', field: 'status' }), state).config.options).toEqual([
      { value: 'open', label: 'Open', color: 'blue' },
      { value: 'review', label: 'Review' },
      { value: 'done', label: 'Done', color: 'success' },
    ]);
  });

  it('gives a rules field the filterable fields, the operators, the kinds and the rows', async () => {
    const optionsFor = vi.fn(() => Promise.resolve([{ value: 'u1', label: 'Ana' }]));
    const { config } = filled(one({ rules: true }, {}, 'Filters'), {}, { ...source, optionsFor });
    expect((config.fields as FieldMeta[]).map((field) => field.key)).toEqual([
      'title',
      'status',
      'assignee',
      'labels',
      'updatedAt',
      'pinned',
    ]);
    expect(config.operators).toBe(operators);
    expect(config.kinds).toBe(kinds);
    const rows = config.optionsFor as (field: FieldMeta) => Promise<FilterOption[]>;
    const assignee = tasks.fields.find((field) => field.key === 'assignee') as FieldMeta;
    const title = tasks.fields.find((field) => field.key === 'title') as FieldMeta;
    await expect(rows(assignee)).resolves.toEqual([{ value: 'u1', label: 'Ana' }]);
    expect(optionsFor).toHaveBeenCalledWith('users', '');
    await expect(rows(title)).resolves.toEqual([]);
  });

  it.each<[string, FieldFilter, RegExp]>([
    ['a field the resource lacks', { op: 'in', field: 'stage' }, /tasks has no field "stage"/],
    ['an attribute it lacks', { op: 'in', field: 'status.colour' }, /no attribute "colour"/],
    ['a field it can’t filter', { op: 'contains', field: 'notes' }, /"notes" can't be filtered/],
    [
      'an operator its query.filter leaves out',
      { op: 'equals', field: 'title' },
      /"title" can't be filtered by "equals"/,
    ],
    [
      'an operator its kind leaves out',
      { range: ['gte', 'contains'], field: 'updatedAt' },
      /"updatedAt" can't be filtered by "contains"/,
    ],
    [
      'equals on a field holding a list',
      { op: 'equals', field: 'labels' },
      /"labels" can't be filtered by "equals"/,
    ],
    ['an operator nothing registered', { op: 'near', field: 'title' }, /no operator "near"/],
    [
      'a preset’s condition it doesn’t allow',
      { presets: [{ value: 'x', label: 'X', filter: { field: 'pinned', op: 'isMe' } }] },
      /"pinned" can't be filtered by "isMe"/,
    ],
  ])('throws, naming the field, on %s', (_, filter, message) => {
    expect(() => fillFilterForm(one(filter, {}, undefined, 'quick'), source)).toThrow(message);
    expect(() => fillFilterForm(one(filter, {}, undefined, 'quick'), source)).toThrow(
      /the field "quick"/,
    );
  });
});
