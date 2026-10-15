import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { actionInputOf, createOf, metaOf, patchOf, placeholdersOf, queryOf, rowOf } from './checks';
import { issuesOf } from './errors';
import type { ResourceMeta } from './meta';
import { createRegistry } from './registry';
import type { FieldMeta, FormatSpec, KindSpec } from './types';

/** Where and why `schema` refuses `input`, as 'path: message'; [] when it takes it. */
function refusals(schema: v.GenericSchema, input: unknown): string[] {
  const result = v.safeParse(schema, input);
  return result.success
    ? []
    : issuesOf(result.issues).map(({ path, message }) => `${path.join('.')}: ${message}`);
}

const reads = { filter: [], sort: false, group: false, search: false };
const fixed = { create: false, update: false, required: false };
const written = { create: true, update: true, required: false };

/** A field of `kind`, read and written as `rest` says. */
function field(key: string, kind: string, rest: Partial<FieldMeta> = {}): FieldMeta {
  return { key, label: key, type: { kind }, query: reads, write: written, ...rest };
}

const status = field('status', 'option', {
  type: {
    kind: 'option',
    settings: {
      options: [
        { value: 'todo', label: 'To do', order: 0, attributes: { kind: 'todo', weight: 0 } },
        { value: 'doing', label: 'Doing', order: 1, attributes: { kind: 'active', weight: 1 } },
        { value: 'shipped', label: 'Shipped', order: 2, attributes: { kind: 'done' } },
      ],
      attributes: [
        {
          key: 'kind',
          label: 'Group',
          kind: 'option',
          options: [
            { value: 'todo', label: 'To do', order: 0 },
            { value: 'active', label: 'Active', order: 1 },
            { value: 'done', label: 'Done', order: 2 },
          ],
        },
        { key: 'weight', label: 'Weight', kind: 'number' },
      ],
    },
  },
  query: { filter: ['equals', 'notEquals', 'in', 'notIn'], sort: true, group: true, search: false },
  write: { create: true, update: true, required: true, default: 'todo' },
});

const items: ResourceMeta = {
  resource: 'items',
  label: { one: 'Item', other: 'Items' },
  roles: { idField: 'id', titleField: 'name', imageField: 'photo', versionField: 'updatedAt' },
  fields: [
    field('id', 'number', {
      query: { ...reads, filter: ['equals', 'in'], sort: true },
      write: fixed,
    }),
    field('title', 'text', {
      query: { filter: ['contains', 'startsWith'], sort: true, group: false, search: true },
      write: { create: true, update: true, required: true },
    }),
    field('name', 'text', { template: '{id} {title}', write: fixed }),
    status,
    field('labels', 'option', {
      type: {
        kind: 'option',
        many: true,
        settings: { options: [{ value: 'ui', label: 'UI', order: 0 }] },
      },
      query: {
        filter: ['in', 'notIn', 'empty', 'notEmpty'],
        sort: false,
        group: true,
        search: false,
      },
    }),
    field('assignee', 'ref', {
      type: { kind: 'ref', settings: { of: 'users' } },
      query: { filter: ['equals', 'empty', 'isMe'], sort: true, group: true, search: false },
    }),
    field('photo', 'url', { template: '/api/items/{id}/photo', write: fixed }),
    field('due', 'date', { query: { ...reads, filter: ['lt', 'inLast'], sort: true } }),
    field('updatedAt', 'datetime', {
      query: { ...reads, filter: ['gte', 'inLast'], sort: true },
      write: fixed,
    }),
    field('data', 'json'),
  ],
  sort: [{ field: 'updatedAt', dir: 'desc' }],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 10 },
    page: { numbered: 'any', cursor: true, total: true, max: 500 },
  },
  actions: [
    {
      name: 'deploy',
      label: 'Deploy',
      on: 'row',
      input: [field('tag', 'text', { write: { create: true, update: false, required: true } })],
      long: true,
    },
  ],
};

const registry = createRegistry();

/** The fixture with one field replaced or added. */
function withField(next: FieldMeta): ResourceMeta {
  const at = items.fields.findIndex((each) => each.key === next.key);
  const fields =
    at === -1
      ? [...items.fields, next]
      : items.fields.map((each, index) => (index === at ? next : each));
  return { ...items, fields };
}

describe('metaOf', () => {
  const meta = metaOf(registry);

  it('takes tickets’ items, every field checked against the registry', () => {
    expect(refusals(meta, items)).toEqual([]);
  });

  it('says it serves the writes its fields take, and a sort no longer than a query’s', () => {
    const readOnly: ResourceMeta = {
      ...items,
      sort: [
        { field: 'updatedAt', dir: 'desc' },
        { field: 'id', dir: 'asc' },
      ],
      serves: { ...items.serves, create: false, sort: { max: 1 } },
    };
    const said = refusals(meta, readOnly);
    expect(said).toContain('fields.1.write.create: a create sets it, but the resource serves none');
    expect(said).toContain('sort: a sort names one field here');
    expect(said.some((each) => each.includes('write.update'))).toBe(false);
  });

  it('refuses the shape’s problems before its own', () => {
    expect(refusals(meta, { ...items, title: 'name' })).toEqual([
      'title: Invalid key: Expected never but received "title"',
    ]);
  });

  it('refuses a kind nothing registered, and takes it once the app registers it', () => {
    const color = field('color', 'color');
    expect(refusals(meta, withField(color))).toEqual(['fields.10.type.kind: no kind "color"']);
    const kind: KindSpec = {
      name: 'color',
      value: () => v.pipe(v.string(), v.hexColor()),
      many: false,
      operators: ['equals'],
      sort: false,
      group: true,
      search: false,
    };
    expect(refusals(metaOf(createRegistry({ kinds: [kind] })), withField(color))).toEqual([]);
  });

  it('checks a field’s settings by its kind’s schema, at their own path', () => {
    const none = field('stage', 'option');
    expect(refusals(meta, withField(none))).toEqual([
      'fields.10.type.settings: the kind "option" needs its settings',
    ]);
    const extra = field('data', 'json', { type: { kind: 'json', settings: { max: 80 } } });
    expect(refusals(meta, withField(extra))).toEqual([
      'fields.9.type.settings: the kind "json" takes no settings',
    ]);
    const misspelt = field('title', 'text', { type: { kind: 'text', settings: { max: 80 } } });
    expect(refusals(meta, withField(misspelt))).toEqual([
      'fields.1.type.settings.max: Invalid key: Expected never but received "max"',
    ]);
    const range = field('score', 'number', {
      type: { kind: 'number', settings: { min: 5, max: 1, integer: true } },
    });
    expect(refusals(meta, withField(range))).toEqual([
      'fields.10.type.settings.max: a number’s max is at least its min',
    ]);
    const twice = field('stage', 'option', {
      type: {
        kind: 'option',
        settings: {
          options: [
            { value: 'a', label: 'A', order: 0 },
            { value: 'a', label: 'A again', order: 1 },
          ],
        },
      },
    });
    expect(refusals(meta, withField(twice))).toEqual([
      'fields.10.type.settings.options.1.value: two options are "a"',
    ]);
    const ref = field('owner', 'ref', { type: { kind: 'ref', settings: { of: '' } } });
    expect(refusals(meta, withField(ref))[0]).toMatch(/^fields\.10\.type\.settings\.of: /);
  });

  it('lets a field of any of bh’s kinds hold a list, an app’s own only where it says so', () => {
    const scores = field('scores', 'number', { type: { kind: 'number', many: true } });
    expect(refusals(meta, withField(scores))).toEqual([]);
    const flags = field('flags', 'boolean', { type: { kind: 'boolean', many: true } });
    expect(refusals(meta, withField(flags))).toEqual([]);
    const color: KindSpec = {
      name: 'color',
      value: () => v.pipe(v.string(), v.hexColor()),
      many: false,
      operators: ['equals'],
      sort: false,
      group: true,
      search: false,
    };
    const colors = field('colors', 'color', { type: { kind: 'color', many: true } });
    expect(refusals(metaOf(createRegistry({ kinds: [color] })), withField(colors))).toEqual([
      'fields.10.type.many: the kind "color" holds one value, never a list',
    ]);
  });

  it('checks a default by the field’s settings: a number’s range, a text’s length and pattern', () => {
    const rating = field('rating', 'number', {
      type: { kind: 'number', settings: { min: 1, max: 5, integer: true } },
      write: { ...written, default: 7 },
    });
    expect(refusals(meta, withField(rating))).toEqual(['fields.10.write.default: at most 5']);
    const half = { ...rating, write: { ...written, default: 2.5 } };
    expect(refusals(meta, withField(half))).toEqual(['fields.10.write.default: a whole number']);
    const code = field('code', 'text', {
      type: { kind: 'text', settings: { maxLength: 5, pattern: '[A-Z]+' } },
      write: { ...written, default: 'TIX-12' },
    });
    expect(refusals(meta, withField(code))).toEqual([
      'fields.10.write.default: at most 5 characters',
      'fields.10.write.default: text matching [A-Z]+',
    ]);
  });

  it('lets a field’s query do no more than its kind allows', () => {
    const query = {
      filter: ['in', 'contains', 'between', 'in'],
      sort: false,
      group: true,
      search: true,
    };
    const title = field('title', 'text', { query });
    expect(refusals(meta, withField(title))).toEqual([
      'fields.1.query.filter.2: no operator "between"',
      'fields.1.query.filter.3: "in" comes twice',
      'fields.1.query.group: the kind "text" can\'t be grouped',
    ]);
    const data = field('data', 'json', {
      query: { filter: ['equals'], sort: true, group: false, search: true },
    });
    expect(refusals(meta, withField(data))).toEqual([
      'fields.9.query.filter.0: the kind "json" can\'t be filtered by "equals"',
      'fields.9.query.sort: the kind "json" can\'t be sorted',
      'fields.9.query.search: the kind "json" can\'t be searched',
    ]);
  });

  it('never offers equals on a field holding a list, nor sorts it', () => {
    const labels = items.fields[4] as FieldMeta;
    const next = { ...labels, query: { ...labels.query, filter: ['equals', 'in'], sort: true } };
    expect(refusals(meta, withField(next))).toEqual([
      'fields.4.query.filter.0: a field holding a list can\'t be filtered by "equals"',
      'fields.4.query.sort: a field holding a list can’t be sorted',
    ]);
  });

  it('checks a default by the field’s kind, a list on a many field', () => {
    const wrong = { ...status, write: { ...status.write, default: 'doing it' } };
    expect(refusals(meta, withField(wrong))).toEqual([
      'fields.3.write.default: no option "doing it"',
    ]);
    const labels = items.fields[4] as FieldMeta;
    const one = { ...labels, write: { ...labels.write, default: 'ui' } };
    expect(refusals(meta, withField(one))[0]).toMatch(/^fields\.4\.write\.default: /);
    const list = { ...labels, write: { ...labels.write, default: ['ui'] } };
    expect(refusals(meta, withField(list))).toEqual([]);
  });

  it('takes a format the app registered for the field’s kind, with options its schema accepts', () => {
    const bytes: FormatSpec = { name: 'bytes', kinds: ['number'] };
    const money: FormatSpec = {
      name: 'money',
      kinds: ['number'],
      options: v.strictObject({ currency: v.pipe(v.string(), v.length(3)) }),
    };
    const size = field('size', 'number', { format: 'bytes' });
    expect(refusals(meta, withField(size))).toEqual(['fields.10.format: no format "bytes"']);
    const formatted = metaOf(createRegistry({ formats: [bytes, money] }));
    expect(refusals(formatted, withField(size))).toEqual([]);
    const price = field('price', 'number', {
      format: { name: 'money', options: { currency: 'EUR' } },
    });
    expect(refusals(formatted, withField(price))).toEqual([]);
    const misread = [
      field('title', 'text', { format: 'bytes', query: items.fields[1]?.query ?? reads }),
      field('price', 'number', { format: { name: 'money', options: { currency: 'euro' } } }),
      field('cost', 'number', { format: 'money' }),
      field('size', 'number', { format: { name: 'bytes', options: { unit: 'kB' } } }),
    ];
    const meta2 = {
      ...items,
      fields: [...items.fields.slice(0, 1), ...misread, ...items.fields.slice(2)],
    };
    expect(refusals(formatted, meta2)).toEqual([
      'fields.1.format: the format "bytes" doesn\'t take the kind "text"',
      'fields.2.format.options.currency: Invalid length: Expected 3 but received 4',
      'fields.3.format: the format "money" needs its options',
      'fields.4.format.options: the format "bytes" takes no options',
    ]);
  });

  it('fills a templated text or url field from the row’s other fields, and never writes it', () => {
    const at = (template: string, rest: Partial<FieldMeta> = {}) => {
      return refusals(meta, withField(field('name', 'text', { template, write: fixed, ...rest })));
    };
    expect(at('{{{id}}} {title} · {status.kind}')).toEqual([]);
    expect(at('{id} {nope}')).toEqual([
      'fields.2.template: the template\'s "{nope}": no field "nope"',
    ]);
    expect(at('{status.kinds}')).toEqual([
      'fields.2.template: the template\'s "{status.kinds}": "status" has no attribute "kinds"',
    ]);
    expect(at('{name}!')).toEqual([
      'fields.2.template: a template names the row\'s other fields, not its own: "{name}"',
    ]);
    expect(at('{id')).toEqual([
      'fields.2.template: a "{" in a template is closed by "}", or written "{{"',
    ]);
    expect(at('id}')).toEqual(['fields.2.template: a "}" in a template is written "}}"']);
    expect(at('{title}', { write: written })).toEqual([
      'fields.2.write: a templated field is never written: the server fills it',
    ]);
    expect(
      refusals(meta, withField(field('total', 'number', { template: '{id}', write: fixed }))),
    ).toEqual(['fields.10.template: a template fills a text or url field, not the kind "number"']);
  });

  it('refuses templates that reach their own field through each other', () => {
    const a = field('a', 'text', { template: '{b}', write: fixed });
    const b = field('b', 'text', { template: 'x {a}', write: fixed });
    expect(refusals(meta, { ...items, fields: [...items.fields, a, b] })).toEqual([
      'fields.10.template: "a" reaches itself through the templates it names',
      'fields.11.template: "b" reaches itself through the templates it names',
    ]);
  });

  it('checks the resource as a whole: keys once, roles, sort and actions', () => {
    const doubled = { ...items, fields: [...items.fields, field('title', 'text')] };
    expect(refusals(meta, doubled)).toEqual(['fields.10.key: two fields are "title"']);
    const roles = {
      ...items,
      roles: { ...items.roles, titleField: 'heading', imageField: 'title' },
    };
    expect(refusals(meta, roles)).toEqual([
      'roles.titleField: no field "heading"',
      'roles.imageField: the image field is a url field',
    ]);
    const sort = {
      ...items,
      sort: [
        { field: 'labels', dir: 'asc' as const },
        { field: 'rank', dir: 'asc' as const },
      ],
    };
    expect(refusals(meta, sort)).toEqual([
      'sort.0.field: "labels" can\'t be sorted',
      'sort.1.field: no field "rank"',
    ]);
    const deploy = items.actions[0];
    const actions = {
      ...items,
      actions: [
        deploy,
        {
          name: 'deploy',
          label: 'Again',
          on: 'resource' as const,
          input: [field('x', 'colour')],
          long: false,
        },
      ],
    };
    expect(refusals(meta, actions)).toEqual([
      'actions.1.name: two actions are "deploy"',
      'actions.1.input.0.type.kind: no kind "colour"',
    ]);
  });

  it('sorts and groups by an attribute’s path as by a field of its kind', () => {
    const byKind = { ...items, sort: [{ field: 'status.kind', dir: 'asc' as const }] };
    expect(refusals(meta, byKind)).toEqual([]);
  });
});

describe('queryOf', () => {
  const query = queryOf(items, registry);

  it('asks no more than the resource serves: how it joins, sorts and pages', () => {
    // As an external API serves it: conditions joined by all, one sort, whole pages.
    const narrow: ResourceMeta = {
      ...items,
      serves: {
        ...items.serves,
        filter: { any: false, not: false },
        sort: { max: 1 },
        page: { numbered: 'pages', cursor: false, total: false, max: 100 },
      },
    };
    const asked = queryOf(narrow, registry);
    expect(
      refusals(asked, {
        filter: { any: [{ not: { field: 'status', op: 'equals', value: 'todo' } }] },
        sort: [
          { field: 'updatedAt', dir: 'desc' },
          { field: 'title', dir: 'asc' },
        ],
        page: { skip: 30, take: 20 },
      }),
    ).toEqual([
      'filter.any: the resource joins conditions by "all" alone, never "any"',
      'filter.any.0.not: the resource joins conditions by "all" alone, never "not"',
      'sort: a sort names one field here',
      'page.skip: the resource skips whole pages: a multiple of 20',
    ]);
    expect(refusals(asked, { page: { cursor: 'eyJpZCI6NDJ9' } })).toEqual([
      'page.cursor: the resource pages by number, never by cursor',
    ]);
    expect(refusals(asked, { page: { take: 200 } })).toEqual([
      'page.take: a page takes at most 100 rows here',
    ]);
    expect(refusals(asked, { page: { skip: 40, take: 20 } })).toEqual([]);
    const cursorOnly = {
      ...narrow,
      serves: {
        ...narrow.serves,
        page: { ...narrow.serves.page, numbered: 'none' as const, cursor: true },
      },
    };
    expect(refusals(queryOf(cursorOnly, registry), { page: { skip: 20 } })).toEqual([
      'page.skip: the resource pages by cursor, never by number',
    ]);
  });

  it('takes one project’s open items, mine, by a field and an attribute’s path', () => {
    const open = {
      filter: {
        all: [
          { not: { field: 'status.kind', op: 'in', value: ['done'] } },
          {
            any: [
              { field: 'assignee', op: 'isMe' },
              { field: 'assignee', op: 'empty' },
            ],
          },
          { field: 'updatedAt', op: 'inLast', value: 7 },
        ],
      },
      search: 'login',
      sort: [{ field: 'status.kind', dir: 'asc' }],
      group: { field: 'status', all: true },
      fields: ['id', 'title'],
    };
    expect(refusals(query, open)).toEqual([]);
  });

  it('reports every condition’s problem at its own path, all at once', () => {
    const filter = {
      all: [
        { field: 'stage', op: 'equals', value: 'x' },
        { field: 'status', op: 'between', value: 'x' },
        { field: 'status', op: 'contains', value: 'do' },
        { any: [{ not: { field: 'status', op: 'in', value: ['todo', 'later'] } }] },
        { field: 'status', op: 'in' },
        { field: 'assignee', op: 'empty', value: 7 },
        { field: 'updatedAt', op: 'inLast', value: 0 },
        { field: 'status.kinds', op: 'in', value: ['done'] },
        { field: 'assignee.name', op: 'equals', value: 'Ana' },
        { field: 'labels', op: 'equals', value: 'ui' },
      ],
    };
    expect(refusals(query, { filter })).toEqual([
      'filter.all.0.field: no field "stage"',
      'filter.all.1.op: no operator "between"',
      'filter.all.2.op: "status" can\'t be filtered by "contains"',
      'filter.all.3.any.0.not.value.1: no option "later"',
      'filter.all.4.value: "in" needs a value',
      'filter.all.5.value: "empty" takes no value',
      expect.stringMatching(/^filter\.all\.6\.value: /),
      'filter.all.7.field: "status" has no attribute "kinds"',
      'filter.all.8.field: "assignee" has no attribute "name"',
      'filter.all.9.op: "labels" can\'t be filtered by "equals"',
    ]);
  });

  it('checks an attribute’s operand by the attribute’s kind', () => {
    const filter = { field: 'status.kind', op: 'in', value: ['active', 'doing'] };
    expect(refusals(query, { filter })).toEqual(['filter.value.1: no option "doing"']);
  });

  it('searches only where a field is searched', () => {
    const unsearched = { ...items, fields: items.fields.filter((each) => each.key !== 'title') };
    const roles = { ...unsearched, roles: { idField: 'id', titleField: 'id' } };
    expect(refusals(queryOf(roles, registry), { search: 'login' })).toEqual([
      'search: no field is searched',
    ]);
  });

  it('sorts and groups only by what allows it, and names fields by their keys', () => {
    const asked = {
      sort: [
        { field: 'labels', dir: 'asc' },
        { field: 'data', dir: 'asc' },
      ],
      group: { field: 'title' },
      fields: ['id', 'status.kind', 'owner'],
    };
    expect(refusals(query, asked)).toEqual([
      'sort.0.field: "labels" can\'t be sorted',
      'sort.1.field: "data" can\'t be sorted',
      'group.field: "title" can\'t be grouped',
      'fields.1: no field "status.kind"',
      'fields.2: no field "owner"',
    ]);
    expect(refusals(query, { group: { field: 'labels' } })).toEqual([]);
    expect(refusals(query, { group: { field: 'status.kind', all: true } })).toEqual([]);
    expect(refusals(query, { group: { field: 'status.weight' } })).toEqual([
      'group.field: "status.weight" can\'t be grouped',
    ]);
  });
});

describe('createOf and patchOf', () => {
  const create = createOf(items, registry);
  const patch = patchOf(items, registry);

  it('take the fields a write may set, each of its kind', () => {
    const values = { title: 'Fix the login', labels: ['ui'], assignee: 7, due: '2026-10-20' };
    expect(refusals(create, { values })).toEqual([]);
    expect(
      refusals(patch, { values: { status: 'doing' }, version: '2026-10-14T00:53:56.753Z' }),
    ).toEqual([]);
  });

  it('require what a create must set, unless it has a default', () => {
    expect(refusals(create, { values: {} })).toEqual(['values.title: "title" is required']);
    expect(refusals(create, { values: { title: 'x', status: null } })).toEqual([
      'values.status: "status" is required',
    ]);
  });

  it('refuse a field there isn’t, one the write may not set, and a value of another kind', () => {
    const values = { title: 'x', id: 7, rank: 1, labels: 'ui', due: '2026-02-30', name: 'TIX-7' };
    expect(refusals(create, { values })).toEqual([
      'values.id: "id" can\'t be set',
      'values.rank: no field "rank"',
      expect.stringMatching(/^values\.labels: /),
      'values.due: a date is a day, YYYY-MM-DD',
      'values.name: "name" can\'t be set',
    ]);
    expect(refusals(patch, { values: { updatedAt: '2026-10-14T00:53:56.753Z' } })).toEqual([
      'values.updatedAt: "updatedAt" can\'t be changed',
    ]);
  });

  it('clear an optional field with null or [], never a required one', () => {
    expect(refusals(patch, { values: { assignee: null, labels: [] } })).toEqual([]);
    expect(refusals(patch, { values: { title: null, status: null } })).toEqual([
      'values.title: "title" can\'t be cleared',
      'values.status: "status" can\'t be cleared',
    ]);
    expect(refusals(patch, { values: { status: [] } })).toEqual(['values.status: no option Array']);
  });
});

describe('actionInputOf', () => {
  const deploy = items.actions[0];

  it('checks an action’s input against its fields, as a create', () => {
    if (!deploy) {
      throw new Error('the fixture has an action');
    }
    const input = actionInputOf(deploy, registry);
    expect(refusals(input, { values: { tag: 'v1.4.0' } })).toEqual([]);
    expect(refusals(input, { values: {} })).toEqual(['values.tag: "tag" is required']);
    expect(refusals(input, { values: { tag: 'v1', force: true } })).toEqual([
      'values.force: no field "force"',
    ]);
  });
});

describe('rowOf', () => {
  const row = rowOf(items, registry);

  it('takes a row whose values are of their fields’ kinds, a key left out absent', () => {
    const one = {
      id: 7,
      title: 'Fix the login',
      name: '7 Fix the login',
      status: 'doing',
      labels: [],
      assignee: null,
      photo: '/api/items/7/photo',
      updatedAt: '2026-10-14T00:53:56.753Z',
      data: { steps: [1, 2] },
    };
    expect(refusals(row, one)).toEqual([]);
    expect(refusals(row, { id: 7, title: 'x' })).toEqual([]);
  });

  it('refuses a key that is no field, and a value of another kind', () => {
    const wrong = {
      id: '7',
      rank: 1,
      status: 'later',
      labels: null,
      photo: '//evil.example/x.png',
      updatedAt: '2026-10-14 00:53',
    };
    expect(refusals(row, wrong)).toEqual([
      expect.stringMatching(/^id: /),
      'rank: no field "rank"',
      'status: no option "later"',
      expect.stringMatching(/^labels: /),
      'photo: a url is absolute, with its scheme, or a path from the root',
      'updatedAt: a datetime is ISO 8601 in UTC, YYYY-MM-DDTHH:mm:ss.sssZ',
    ]);
  });
});

describe('placeholdersOf', () => {
  it('reads a template’s paths, a doubled brace a brace', () => {
    expect(placeholdersOf('{project}-{number} {title}')).toEqual(['project', 'number', 'title']);
    expect(placeholdersOf('{{literal}} {status.kind}')).toEqual(['status.kind']);
    expect(placeholdersOf('no placeholders')).toEqual([]);
  });
});
