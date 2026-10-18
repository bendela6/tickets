---
title: Filter forms
summary: "Draw a form as the filters above a list: its value is the query's own
  { search, filter }, its fields filled from the resource's metadata."
order: 11
related: [Instrument's bindings, Building a form, The registry]
---

[//]: # 'written from filter-form.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Filter forms

`FilterForm` draws a form as the filters above a list. Its value is the
query's own `{ search, filter }`, so it passes straight into a query,
and each field takes its label and options from the resource's
metadata. The form says only which part of the filter each field
holds, with `filter` ([Building a form](building-a-form.md)).

## Import

```tsx
import { FilterForm } from '@bh/form';
```

## Anatomy

A search, presets, quick fields and the reader's own rules, in one
`inline` row, then the count and Clear. Every field's conditions are
joined by `all`. The demo's rows are filtered in the browser, by
`matchesFilter` from `@bh/resource`, as a client keeps a list it holds.

**Filter anatomy**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, FilterForm, type FilterQuery, FormProvider } from '@bh/form';
import {
  createRegistry,
  type FieldMeta,
  matchesFilter,
  type ResourceMeta,
  type Row,
} from '@bh/resource';
import { baseFilter, baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  root: { Component: RootWrapper },
  field: { Component: FieldWrapper },
  action: { Component: FormButton },
  filter: baseFilter,
});

/** A field of the made-up tasks, filtered by `filter`'s operators. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: filter.includes('in'), search: key === 'title' },
    write: { create: true, update: true, required: false },
  };
}

const LISTS = ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'];

const tasks: ResourceMeta = {
  resource: 'tasks',
  label: { one: 'task', other: 'tasks' },
  roles: { idField: 'id', titleField: 'title' },
  fields: [
    field('title', 'Title', { kind: 'text' }, ['contains', 'startsWith']),
    field(
      'status',
      'Status',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'open', label: 'Open', color: 'blue', order: 0 },
            { value: 'review', label: 'Review', color: 'orange', order: 1 },
            { value: 'done', label: 'Done', color: 'green', order: 2 },
          ],
        },
      },
      LISTS,
    ),
    field(
      'priority',
      'Priority',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'high', label: 'High', color: 'red', order: 0 },
            { value: 'normal', label: 'Normal', order: 1 },
          ],
        },
      },
      LISTS,
    ),
    field('owner', 'Owner', { kind: 'ref', settings: { of: 'users' } }, [...LISTS, 'isMe']),
    field('updated', 'Updated', { kind: 'datetime' }, ['gte', 'lte', 'inLast', 'notInLast']),
    field('pinned', 'Pinned', { kind: 'boolean' }, ['equals']),
  ],
  sort: [],
  actions: [],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 1 },
    page: { numbered: 'any', cursor: false, total: true, max: 100 },
  },
};

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const ROWS: Row[] = [
  {
    id: '1',
    title: 'Fix the login redirect',
    status: 'open',
    priority: 'high',
    owner: 'u1',
    updated: daysAgo(1),
    pinned: true,
  },
  {
    id: '2',
    title: 'Write the release notes',
    status: 'review',
    priority: 'normal',
    owner: 'u2',
    updated: daysAgo(3),
    pinned: false,
  },
  {
    id: '3',
    title: 'Move the logs to the new disk',
    status: 'open',
    priority: 'normal',
    owner: null,
    updated: daysAgo(12),
    pinned: false,
  },
  {
    id: '4',
    title: 'Fix the flaky upload test',
    status: 'done',
    priority: 'high',
    owner: 'u1',
    updated: daysAgo(20),
    pinned: false,
  },
  {
    id: '5',
    title: 'Draw the empty states',
    status: 'open',
    priority: 'normal',
    owner: 'u1',
    updated: daysAgo(2),
    pinned: false,
  },
  {
    id: '6',
    title: 'Answer the login questions',
    status: 'review',
    priority: 'high',
    owner: null,
    updated: daysAgo(6),
    pinned: true,
  },
];

const contract = createRegistry();
const { operators, kinds } = contract;
// The reader, as `isMe` knows them.
const ME = 'u1';

/** The rows a query lets through: its search in their titles, its filter by matchesFilter. */
function rowsOf(query: FilterQuery): Row[] {
  const text = query.search?.toLowerCase() ?? '';
  return ROWS.filter((row) => {
    return (
      String(row.title).toLowerCase().includes(text) &&
      matchesFilter(query.filter, row, tasks, contract, ME)
    );
  });
}

const form = defineForm(registry).build((b) => {
  return [
    b.inline({ overflow: 'wrap' }, [
      b.search({
        name: 'search',
        label: 'Search',
        config: { placeholder: 'Search titles', shortcut: '/' },
      }),
      b['toggle-chips']({
        name: 'presets',
        label: 'Presets',
        config: { counts: true },
        filter: {
          presets: [
            { value: 'mine', label: 'Mine', filter: { field: 'owner', op: 'isMe' } },
            {
              value: 'recent',
              label: 'Updated this week',
              filter: { field: 'updated', op: 'inLast', value: 7 },
            },
          ],
        },
      }),
      b['toggle-chips']({ name: 'status', config: { counts: true }, filter: { op: 'in' } }),
      b.select({ name: 'priority', config: { placeholder: 'any' }, filter: { op: 'equals' } }),
      b.rules({
        name: 'rules',
        label: 'Filters',
        config: { add: 'chips' },
        filter: { rules: true },
      }),
      b.slot({ name: 'count' }),
      b.reset({ label: 'Clear', to: 'start' }),
    ]),
  ];
});

export function FilterAnatomy() {
  const [value, setValue] = useState<FilterQuery>({ filter: { all: [] } });
  const shown = rowsOf(value);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full flex-col gap-12">
        <FilterForm
          form={form}
          value={value}
          onChange={setValue}
          meta={tasks}
          operators={operators}
          kinds={kinds}
          optionsFor={() => {
            return Promise.resolve([
              { value: 'u1', label: 'Ana Beridze' },
              { value: 'u2', label: 'Bo Chen' },
            ]);
          }}
          // Each status's rows, with the rest of the filter as it is.
          countsBy={(path, query) => {
            const counts: Record<string, number> = {};
            for (const row of rowsOf(query)) {
              const key = String(row[path]);
              counts[key] = (counts[key] ?? 0) + 1;
            }
            return Promise.resolve(counts);
          }}
          countFor={(query) => Promise.resolve(rowsOf(query).length)}
          count={{ shown: shown.length, total: ROWS.length }}
        />
        <ul className="text-13 text-gray-12 flex flex-col gap-4 font-sans">
          {shown.map((row) => {
            return <li key={String(row.id)}>{String(row.title)}</li>;
          })}
        </ul>
        <pre className="text-11 text-gray-11 font-mono whitespace-pre-wrap">
          {JSON.stringify(value)}
        </pre>
      </div>
    </FormProvider>
  );
}
```

- The search is the field named `search`: the query's `search`, left
  out while it's empty.
- "Mine" writes `{ field: 'owner', op: 'isMe' }`, so a saved view's
  "Mine" means whoever opens it. "Updated this week" writes `inLast`,
  7 days back from now, so it keeps rolling.
- A field with `counts: true` shows each option's rows, as picking it
  would leave them: the field's own condition is left out, so picking a
  second status doesn't zero the rest. `countsBy` gives them, a grouped
  count on that field, 0 for an option it leaves out; a presets field's
  come from `countFor`.
- The `count` slot draws the registry's `filter.count` with `count` and
  the resource's name for its rows: "4 of 6 tasks".

## Applying it

Without a submit in the tree, each change applies at once: `onChange`
runs from each commit, and a search after its pause. With one, it runs
on submit, and until then the `changes` slot says how many fields hold
a change not applied: "2 changes waiting". Clear is the form's reset
with `to: 'start'`: the form starts with no field holding a condition,
and shows `value` apart from that, so Clear empties it, after an Apply
too. A new `value` from outside, after Back, puts the fields there
without calling `onChange`.

**Filter apply button**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, FilterForm, type FilterQuery, FormProvider } from '@bh/form';
import {
  createRegistry,
  type FieldMeta,
  matchesFilter,
  type ResourceMeta,
  type Row,
} from '@bh/resource';
import { baseFilter, baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  root: { Component: RootWrapper },
  field: { Component: FieldWrapper },
  action: { Component: FormButton },
  filter: baseFilter,
});

/** A field of the made-up tasks, filtered by `filter`'s operators. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: filter.includes('in'), search: key === 'title' },
    write: { create: true, update: true, required: false },
  };
}

const LISTS = ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'];

const tasks: ResourceMeta = {
  resource: 'tasks',
  label: { one: 'task', other: 'tasks' },
  roles: { idField: 'id', titleField: 'title' },
  fields: [
    field('title', 'Title', { kind: 'text' }, ['contains', 'startsWith']),
    field(
      'status',
      'Status',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'open', label: 'Open', color: 'blue', order: 0 },
            { value: 'review', label: 'Review', color: 'orange', order: 1 },
            { value: 'done', label: 'Done', color: 'green', order: 2 },
          ],
        },
      },
      LISTS,
    ),
    field(
      'priority',
      'Priority',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'high', label: 'High', color: 'red', order: 0 },
            { value: 'normal', label: 'Normal', order: 1 },
          ],
        },
      },
      LISTS,
    ),
    field('owner', 'Owner', { kind: 'ref', settings: { of: 'users' } }, [...LISTS, 'isMe']),
    field('updated', 'Updated', { kind: 'datetime' }, ['gte', 'lte', 'inLast', 'notInLast']),
    field('pinned', 'Pinned', { kind: 'boolean' }, ['equals']),
  ],
  sort: [],
  actions: [],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 1 },
    page: { numbered: 'any', cursor: false, total: true, max: 100 },
  },
};

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const ROWS: Row[] = [
  {
    id: '1',
    title: 'Fix the login redirect',
    status: 'open',
    priority: 'high',
    owner: 'u1',
    updated: daysAgo(1),
    pinned: true,
  },
  {
    id: '2',
    title: 'Write the release notes',
    status: 'review',
    priority: 'normal',
    owner: 'u2',
    updated: daysAgo(3),
    pinned: false,
  },
  {
    id: '3',
    title: 'Move the logs to the new disk',
    status: 'open',
    priority: 'normal',
    owner: null,
    updated: daysAgo(12),
    pinned: false,
  },
  {
    id: '4',
    title: 'Fix the flaky upload test',
    status: 'done',
    priority: 'high',
    owner: 'u1',
    updated: daysAgo(20),
    pinned: false,
  },
  {
    id: '5',
    title: 'Draw the empty states',
    status: 'open',
    priority: 'normal',
    owner: 'u1',
    updated: daysAgo(2),
    pinned: false,
  },
  {
    id: '6',
    title: 'Answer the login questions',
    status: 'review',
    priority: 'high',
    owner: null,
    updated: daysAgo(6),
    pinned: true,
  },
];

const contract = createRegistry();
const { operators, kinds } = contract;
// The reader, as `isMe` knows them.
const ME = 'u1';

/** The rows a query lets through: its search in their titles, its filter by matchesFilter. */
function rowsOf(query: FilterQuery): Row[] {
  const text = query.search?.toLowerCase() ?? '';
  return ROWS.filter((row) => {
    return (
      String(row.title).toLowerCase().includes(text) &&
      matchesFilter(query.filter, row, tasks, contract, ME)
    );
  });
}

const form = defineForm(registry).build((b) => {
  return [
    b.inline({ overflow: 'wrap' }, [
      b.search({ name: 'search', label: 'Search', config: { placeholder: 'Search titles' } }),
      b['toggle-chips']({ name: 'status', config: {}, filter: { op: 'in' } }),
      b.select({ name: 'priority', config: { placeholder: 'any' }, filter: { op: 'equals' } }),
      b.slot({ name: 'changes' }),
      b.reset({ label: 'Clear', to: 'start' }),
      b.submit({ label: 'Apply' }),
    ]),
  ];
});

export function FilterApplyButton() {
  const [value, setValue] = useState<FilterQuery>({ filter: { all: [] } });
  const shown = rowsOf(value);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full flex-col gap-12">
        <FilterForm
          form={form}
          value={value}
          onChange={setValue}
          meta={tasks}
          operators={operators}
          kinds={kinds}
        />
        <ul className="text-13 text-gray-12 flex flex-col gap-4 font-sans">
          {shown.map((row) => {
            return <li key={String(row.id)}>{String(row.title)}</li>;
          })}
        </ul>
        <pre className="text-11 text-gray-11 font-mono whitespace-pre-wrap">
          {JSON.stringify(value)}
        </pre>
      </div>
    </FormProvider>
  );
}
```

## Locked conditions

`locked` holds the conditions the page sets, as a project's board sets
its project. They're in every value `onChange` hands out, and drawn
first, as a read-only `rules` field of grey chips with a lock: neither
the reader nor Clear takes them away. A value holding them shows them
there, and in no other field.

**Filter locked**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, FilterForm, type FilterQuery, FormProvider } from '@bh/form';
import {
  createRegistry,
  type FieldMeta,
  matchesFilter,
  type ResourceMeta,
  type Row,
} from '@bh/resource';
import { baseFilter, baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  root: { Component: RootWrapper },
  field: { Component: FieldWrapper },
  action: { Component: FormButton },
  filter: baseFilter,
});

/** A field of the made-up tasks, filtered by `filter`'s operators. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: filter.includes('in'), search: key === 'title' },
    write: { create: true, update: true, required: false },
  };
}

const LISTS = ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'];

const tasks: ResourceMeta = {
  resource: 'tasks',
  label: { one: 'task', other: 'tasks' },
  roles: { idField: 'id', titleField: 'title' },
  fields: [
    field('title', 'Title', { kind: 'text' }, ['contains', 'startsWith']),
    field(
      'status',
      'Status',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'open', label: 'Open', color: 'blue', order: 0 },
            { value: 'review', label: 'Review', color: 'orange', order: 1 },
            { value: 'done', label: 'Done', color: 'green', order: 2 },
          ],
        },
      },
      LISTS,
    ),
    field(
      'priority',
      'Priority',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'high', label: 'High', color: 'red', order: 0 },
            { value: 'normal', label: 'Normal', order: 1 },
          ],
        },
      },
      LISTS,
    ),
    field('owner', 'Owner', { kind: 'ref', settings: { of: 'users' } }, [...LISTS, 'isMe']),
    field('updated', 'Updated', { kind: 'datetime' }, ['gte', 'lte', 'inLast', 'notInLast']),
    field('pinned', 'Pinned', { kind: 'boolean' }, ['equals']),
  ],
  sort: [],
  actions: [],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 1 },
    page: { numbered: 'any', cursor: false, total: true, max: 100 },
  },
};

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const ROWS: Row[] = [
  {
    id: '1',
    title: 'Fix the login redirect',
    status: 'open',
    priority: 'high',
    owner: 'u1',
    updated: daysAgo(1),
    pinned: true,
  },
  {
    id: '2',
    title: 'Write the release notes',
    status: 'review',
    priority: 'normal',
    owner: 'u2',
    updated: daysAgo(3),
    pinned: false,
  },
  {
    id: '3',
    title: 'Move the logs to the new disk',
    status: 'open',
    priority: 'normal',
    owner: null,
    updated: daysAgo(12),
    pinned: false,
  },
  {
    id: '4',
    title: 'Fix the flaky upload test',
    status: 'done',
    priority: 'high',
    owner: 'u1',
    updated: daysAgo(20),
    pinned: false,
  },
  {
    id: '5',
    title: 'Draw the empty states',
    status: 'open',
    priority: 'normal',
    owner: 'u1',
    updated: daysAgo(2),
    pinned: false,
  },
  {
    id: '6',
    title: 'Answer the login questions',
    status: 'review',
    priority: 'high',
    owner: null,
    updated: daysAgo(6),
    pinned: true,
  },
];

const contract = createRegistry();
const { operators, kinds } = contract;
// The reader, as `isMe` knows them.
const ME = 'u1';

/** The rows a query lets through: its search in their titles, its filter by matchesFilter. */
function rowsOf(query: FilterQuery): Row[] {
  const text = query.search?.toLowerCase() ?? '';
  return ROWS.filter((row) => {
    return (
      String(row.title).toLowerCase().includes(text) &&
      matchesFilter(query.filter, row, tasks, contract, ME)
    );
  });
}

const form = defineForm(registry).build((b) => {
  return [
    b.inline({ overflow: 'wrap' }, [
      b.search({ name: 'search', label: 'Search', config: { placeholder: 'Search titles' } }),
      b.select({ name: 'priority', config: { placeholder: 'any' }, filter: { op: 'equals' } }),
      b.rules({
        name: 'rules',
        label: 'Filters',
        config: { add: 'chips' },
        filter: { rules: true },
      }),
      b.slot({ name: 'count' }),
      b.reset({ label: 'Clear', to: 'start' }),
    ]),
  ];
});

// The page shows the work still to do: every value it hands out keeps this.
const locked = { field: 'status', op: 'notEquals', value: 'done' };

export function FilterLocked() {
  const [value, setValue] = useState<FilterQuery>({ filter: { all: [locked] } });
  const shown = rowsOf(value);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full flex-col gap-12">
        <FilterForm
          form={form}
          value={value}
          onChange={setValue}
          meta={tasks}
          operators={operators}
          kinds={kinds}
          locked={locked}
          count={{ shown: shown.length, total: ROWS.length }}
        />
        <ul className="text-13 text-gray-12 flex flex-col gap-4 font-sans">
          {shown.map((row) => {
            return <li key={String(row.id)}>{String(row.title)}</li>;
          })}
        </ul>
        <pre className="text-11 text-gray-11 font-mono whitespace-pre-wrap">
          {JSON.stringify(value)}
        </pre>
      </div>
    </FormProvider>
  );
}
```

## A value holding a group

A value from a saved view may hold what no quick field can show: an
`any` group, a `not`. The form's `rules` field takes it, as a chip of
its own; with no `rules` field, it is handed back unchanged with each
change, until Clear.

**Filter group**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, FilterForm, type FilterQuery, FormProvider } from '@bh/form';
import {
  createRegistry,
  type FieldMeta,
  matchesFilter,
  type ResourceMeta,
  type Row,
} from '@bh/resource';
import { baseFilter, baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  root: { Component: RootWrapper },
  field: { Component: FieldWrapper },
  action: { Component: FormButton },
  filter: baseFilter,
});

/** A field of the made-up tasks, filtered by `filter`'s operators. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: filter.includes('in'), search: key === 'title' },
    write: { create: true, update: true, required: false },
  };
}

const LISTS = ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'];

const tasks: ResourceMeta = {
  resource: 'tasks',
  label: { one: 'task', other: 'tasks' },
  roles: { idField: 'id', titleField: 'title' },
  fields: [
    field('title', 'Title', { kind: 'text' }, ['contains', 'startsWith']),
    field(
      'status',
      'Status',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'open', label: 'Open', color: 'blue', order: 0 },
            { value: 'review', label: 'Review', color: 'orange', order: 1 },
            { value: 'done', label: 'Done', color: 'green', order: 2 },
          ],
        },
      },
      LISTS,
    ),
    field(
      'priority',
      'Priority',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'high', label: 'High', color: 'red', order: 0 },
            { value: 'normal', label: 'Normal', order: 1 },
          ],
        },
      },
      LISTS,
    ),
    field('owner', 'Owner', { kind: 'ref', settings: { of: 'users' } }, [...LISTS, 'isMe']),
    field('updated', 'Updated', { kind: 'datetime' }, ['gte', 'lte', 'inLast', 'notInLast']),
    field('pinned', 'Pinned', { kind: 'boolean' }, ['equals']),
  ],
  sort: [],
  actions: [],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 1 },
    page: { numbered: 'any', cursor: false, total: true, max: 100 },
  },
};

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const ROWS: Row[] = [
  {
    id: '1',
    title: 'Fix the login redirect',
    status: 'open',
    priority: 'high',
    owner: 'u1',
    updated: daysAgo(1),
    pinned: true,
  },
  {
    id: '2',
    title: 'Write the release notes',
    status: 'review',
    priority: 'normal',
    owner: 'u2',
    updated: daysAgo(3),
    pinned: false,
  },
  {
    id: '3',
    title: 'Move the logs to the new disk',
    status: 'open',
    priority: 'normal',
    owner: null,
    updated: daysAgo(12),
    pinned: false,
  },
  {
    id: '4',
    title: 'Fix the flaky upload test',
    status: 'done',
    priority: 'high',
    owner: 'u1',
    updated: daysAgo(20),
    pinned: false,
  },
  {
    id: '5',
    title: 'Draw the empty states',
    status: 'open',
    priority: 'normal',
    owner: 'u1',
    updated: daysAgo(2),
    pinned: false,
  },
  {
    id: '6',
    title: 'Answer the login questions',
    status: 'review',
    priority: 'high',
    owner: null,
    updated: daysAgo(6),
    pinned: true,
  },
];

const contract = createRegistry();
const { operators, kinds } = contract;
// The reader, as `isMe` knows them.
const ME = 'u1';

/** The rows a query lets through: its search in their titles, its filter by matchesFilter. */
function rowsOf(query: FilterQuery): Row[] {
  const text = query.search?.toLowerCase() ?? '';
  return ROWS.filter((row) => {
    return (
      String(row.title).toLowerCase().includes(text) &&
      matchesFilter(query.filter, row, tasks, contract, ME)
    );
  });
}

const form = defineForm(registry).build((b) => {
  return [
    b.inline({ overflow: 'wrap' }, [
      b.search({ name: 'search', label: 'Search', config: { placeholder: 'Search titles' } }),
      b['toggle-chips']({ name: 'status', config: {}, filter: { op: 'in' } }),
      b.rules({
        name: 'rules',
        label: 'Filters',
        config: { add: 'chips' },
        filter: { rules: true },
      }),
      b.reset({ label: 'Clear', to: 'start' }),
    ]),
  ];
});

export function FilterGroup() {
  // From a saved view: mine, or pinned, among the open ones.
  const [value, setValue] = useState<FilterQuery>({
    filter: {
      all: [
        { field: 'status', op: 'in', value: ['open'] },
        {
          any: [
            { field: 'owner', op: 'isMe' },
            { field: 'pinned', op: 'equals', value: true },
          ],
        },
      ],
    },
  });
  const shown = rowsOf(value);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full flex-col gap-12">
        <FilterForm
          form={form}
          value={value}
          onChange={setValue}
          meta={tasks}
          operators={operators}
          kinds={kinds}
        />
        <ul className="text-13 text-gray-12 flex flex-col gap-4 font-sans">
          {shown.map((row) => {
            return <li key={String(row.id)}>{String(row.title)}</li>;
          })}
        </ul>
        <pre className="text-11 text-gray-11 font-mono whitespace-pre-wrap">
          {JSON.stringify(value)}
        </pre>
      </div>
    </FormProvider>
  );
}
```

## On a phone

Narrower than its layout's `narrow.below`, measured on the form's own
width, the bar keeps the fields `narrow.keep` names, still applying at
once, and puts a Filters button where the first of the rest was, its
badge the conditions they hold. The button opens the registry's
`filter.sheet`: a second form of the other fields over the same value,
drawn with their labels above. It applies on its submit, then closes:
the config's own, or "Show {count} items", `{count}` from `countFor`
a pause after each change. Its Clear empties its own fields only.

**Filter phone**

```tsx
import { useState } from 'react';
import { defineForm, defineRegistry, FilterForm, type FilterQuery, FormProvider } from '@bh/form';
import {
  createRegistry,
  type FieldMeta,
  matchesFilter,
  type ResourceMeta,
  type Row,
} from '@bh/resource';
import { baseFilter, baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  root: { Component: RootWrapper },
  field: { Component: FieldWrapper },
  action: { Component: FormButton },
  filter: baseFilter,
});

/** A field of the made-up tasks, filtered by `filter`'s operators. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: filter.includes('in'), search: key === 'title' },
    write: { create: true, update: true, required: false },
  };
}

const LISTS = ['equals', 'notEquals', 'in', 'notIn', 'empty', 'notEmpty'];

const tasks: ResourceMeta = {
  resource: 'tasks',
  label: { one: 'task', other: 'tasks' },
  roles: { idField: 'id', titleField: 'title' },
  fields: [
    field('title', 'Title', { kind: 'text' }, ['contains', 'startsWith']),
    field(
      'status',
      'Status',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'open', label: 'Open', color: 'blue', order: 0 },
            { value: 'review', label: 'Review', color: 'orange', order: 1 },
            { value: 'done', label: 'Done', color: 'green', order: 2 },
          ],
        },
      },
      LISTS,
    ),
    field(
      'priority',
      'Priority',
      {
        kind: 'option',
        settings: {
          options: [
            { value: 'high', label: 'High', color: 'red', order: 0 },
            { value: 'normal', label: 'Normal', order: 1 },
          ],
        },
      },
      LISTS,
    ),
    field('owner', 'Owner', { kind: 'ref', settings: { of: 'users' } }, [...LISTS, 'isMe']),
    field('updated', 'Updated', { kind: 'datetime' }, ['gte', 'lte', 'inLast', 'notInLast']),
    field('pinned', 'Pinned', { kind: 'boolean' }, ['equals']),
  ],
  sort: [],
  actions: [],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 1 },
    page: { numbered: 'any', cursor: false, total: true, max: 100 },
  },
};

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const ROWS: Row[] = [
  {
    id: '1',
    title: 'Fix the login redirect',
    status: 'open',
    priority: 'high',
    owner: 'u1',
    updated: daysAgo(1),
    pinned: true,
  },
  {
    id: '2',
    title: 'Write the release notes',
    status: 'review',
    priority: 'normal',
    owner: 'u2',
    updated: daysAgo(3),
    pinned: false,
  },
  {
    id: '3',
    title: 'Move the logs to the new disk',
    status: 'open',
    priority: 'normal',
    owner: null,
    updated: daysAgo(12),
    pinned: false,
  },
  {
    id: '4',
    title: 'Fix the flaky upload test',
    status: 'done',
    priority: 'high',
    owner: 'u1',
    updated: daysAgo(20),
    pinned: false,
  },
  {
    id: '5',
    title: 'Draw the empty states',
    status: 'open',
    priority: 'normal',
    owner: 'u1',
    updated: daysAgo(2),
    pinned: false,
  },
  {
    id: '6',
    title: 'Answer the login questions',
    status: 'review',
    priority: 'high',
    owner: null,
    updated: daysAgo(6),
    pinned: true,
  },
];

const contract = createRegistry();
const { operators, kinds } = contract;
// The reader, as `isMe` knows them.
const ME = 'u1';

/** The rows a query lets through: its search in their titles, its filter by matchesFilter. */
function rowsOf(query: FilterQuery): Row[] {
  const text = query.search?.toLowerCase() ?? '';
  return ROWS.filter((row) => {
    return (
      String(row.title).toLowerCase().includes(text) &&
      matchesFilter(query.filter, row, tasks, contract, ME)
    );
  });
}

const form = defineForm(registry).build((b) => {
  return [
    // Narrower than 640 pixels, the bar keeps the search, and a sheet holds the rest.
    b.inline({ overflow: 'wrap', narrow: { below: 640, keep: ['search'] } }, [
      b.search({ name: 'search', label: 'Search', config: { placeholder: 'Search titles' } }),
      b['toggle-chips']({
        name: 'presets',
        label: 'Presets',
        config: {},
        filter: {
          presets: [
            { value: 'mine', label: 'Mine', filter: { field: 'owner', op: 'isMe' } },
            {
              value: 'recent',
              label: 'Updated this week',
              filter: { field: 'updated', op: 'inLast', value: 7 },
            },
          ],
        },
      }),
      b['toggle-chips']({ name: 'status', config: {}, filter: { op: 'in' } }),
      b.select({ name: 'priority', config: { placeholder: 'any' }, filter: { op: 'equals' } }),
      b.slot({ name: 'count' }),
      b.reset({ label: 'Clear', to: 'start' }),
    ]),
  ];
});

export function FilterPhone() {
  const [value, setValue] = useState<FilterQuery>({ filter: { all: [] } });
  const shown = rowsOf(value);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full flex-col gap-12">
        <FilterForm
          form={form}
          value={value}
          onChange={setValue}
          meta={tasks}
          operators={operators}
          kinds={kinds}
          // The sheet's "Show 4 items": what its fields would let through.
          countFor={(query) => Promise.resolve(rowsOf(query).length)}
          count={{ shown: shown.length, total: ROWS.length }}
        />
        <ul className="text-13 text-gray-12 flex flex-col gap-4 font-sans">
          {shown.map((row) => {
            return <li key={String(row.id)}>{String(row.title)}</li>;
          })}
        </ul>
        <pre className="text-11 text-gray-11 font-mono whitespace-pre-wrap">
          {JSON.stringify(value)}
        </pre>
      </div>
    </FormProvider>
  );
}
```

## Fields from the metadata

Each field with a `filter` takes these from the field its
`filter.field`, or its name, names in `meta`:

- its label, unless the form gives one;
- its options, unless its config gives some: an option field's, in
  their order and colors, archived ones only while the value holds
  them; an option attribute's, for a path (`status.kind`); a ref
  field's rows from `optionsFor`, loaded as the field draws; else a
  `map`'s keys. A presets field offers its presets;
- a `rules` field, the fields that can be filtered, the operators, the
  kinds and the rows.

Building throws, naming the field, when its `filter` names a field or
an attribute `meta` lacks, a field that can't be filtered, or an
operator nothing registered, or that the field's kind or its
`query.filter` doesn't allow.

## What a field holds

A field's `filter` (`FieldFilter`) says which part of the filter it
holds, and how its value folds into the query's `{ all: [...] }` and
spreads back:

- `{ op }`: `{ field, op, value }`, unless the value is its kind's
  empty one (`''`, `null`, `[]`, `false`) or `map` turns it to `null`.
  An operator that takes no operand, `empty`, `notEmpty` or `isMe`,
  writes `{ field, op }` while the value isn't empty. Spread back, the
  field takes the first condition with its field and operator, through
  `map` reversed.
- `{ range }`: a condition for each half that's set.
- `{ presets }`: the filter of each preset that's on. A preset is on
  when every condition of its filter is in the value; a field holding
  one preset takes the one with the most conditions.
- `{ rules: true }`: each entry as it is. It takes what no other field
  does, groups too.

The same condition is written once, and one a field drops is dropped
by every field holding it: unpicking "Mine" in the presets unticks a
quick "Only mine". A hidden field writes nothing. A field the value
sets nothing of holds its map's key for `null`, else its empty value.

## Props

| Prop                   | Type                                                                        | Default | Description                                                                                                                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form` (required)      | `FormConfig<I, L>`                                                          |         | The filters: fields that each hold a part of the filter (their `filter`), in layouts, with the form's buttons and slots. A submit in it makes the form apply with that button; without one, each change applies at once.                                                  |
| `value` (required)     | `FilterValue`                                                               |         | The filter it shows, as the address holds it. A new one, after Back, puts the fields there without calling `onChange`.                                                                                                                                                    |
| `onChange` (required)  | `(next: FilterQuery) => void`                                               |         | Called with the new `{ search, filter }`, which passes straight into a query: at each change, or on submit in a form with a submit.                                                                                                                                       |
| `slots`                | `{ end?: ReactNode }`                                                       |         | What the form's slots hold: `end`, after the fields, the app's own.                                                                                                                                                                                                       |
| `meta` (required)      | `ResourceMeta`                                                              |         | The resource's metadata. Each field takes its label and options from the field its `filter` names, and a `filter` it doesn't allow is an error.                                                                                                                           |
| `operators` (required) | `OperatorRegistry`                                                          |         | The operators its fields are filtered by: bh's and the app's own.                                                                                                                                                                                                         |
| `kinds` (required)     | `KindRegistry`                                                              |         | The kinds its fields are of: bh's and the app's own.                                                                                                                                                                                                                      |
| `optionsFor`           | `(resource: string, text: string) => Promise<FilterOption[]>`               |         | A ref field's rows, from the resource it names: the first page of those matching `text`.                                                                                                                                                                                  |
| `countsBy`             | `(field: FieldPath, value: FilterQuery) => Promise<Record<string, number>>` |         | How many rows each of a field's values would show, by value: a grouped count on that field or path, of the query given. Fills the options' counts of a field with `counts: true` in its config; an option it leaves out shows 0.                                          |
| `countFor`             | `(value: FilterQuery) => Promise<number>`                                   |         | How many rows a query shows: each preset's count, of a presets field with `counts: true`.                                                                                                                                                                                 |
| `locked`               | `Filter`                                                                    |         | The conditions the page sets ("Project is TIX"), in every value `onChange` hands out. Drawn first, as a read-only `rules` field of grey chips with a lock, which neither the reader nor Clear can take away; a value holding them shows them there and in no other field. |
| `count`                | `{ shown: number; total: number } \| 'loading'`                             |         | How many rows the filter lets through, of how many in all, or 'loading' while they are counted: the `count` slot draws it with the registry's `filter.count` and the resource's name for its rows.                                                                        |

## Reference

```ts
interface FilterValue
```

What a filter form shows: the query's own `search` and `filter`, as the address holds them.

| Member   | Type     | Default | Description                                                               |
| -------- | -------- | ------- | ------------------------------------------------------------------------- |
| `search` | `string` |         | What the field named `search` holds.                                      |
| `filter` | `Filter` |         | The conditions, in one `all` as a filter form writes them, or any filter. |

```ts
interface FilterQuery
```

What a filter form hands out: the query's own `search` and `filter`
(`Query` in `@bh/resource`), so it passes straight into a query.

| Member              | Type     | Default | Description                                                                     |
| ------------------- | -------- | ------- | ------------------------------------------------------------------------------- |
| `search`            | `string` |         | What the field named `search` holds; left out when it's empty.                  |
| `filter` (required) | `Filter` |         | Every field's conditions, in one `all`: a filter form's are joined by all only. |

```ts
interface FilterOption
```

A choice a filter field offers: an option of the resource's, a preset, a ref's row.

| Member             | Type     | Default | Description                                                                   |
| ------------------ | -------- | ------- | ----------------------------------------------------------------------------- |
| `value` (required) | `string` |         | What the field holds for it, and the operand it writes: `'in-progress'`.      |
| `label` (required) | `string` |         | How it reads: `'In progress'`.                                                |
| `color`            | `string` |         | A bh tone, as an option's in the metadata: `'blue'`, `'success'`.             |
| `count`            | `number` |         | How many rows picking it would show, when the field's config asks for counts. |

```ts
type FieldFilter = …
```

Which part of the query's filter a field holds: plain data, so a stored
`FormConfig` keeps it as it is. A filter form folds every field's value into
one `{ all: [...] }` by it, and puts a filter back onto its fields.

- `{ op }`: the field's value is the operand of `field op value`. `field` is
  the field's own name when absent. `map` turns an input's value, as a
  string key (`'true'`, `'24h'`), into the operand, and `null` into no
  condition.
- `{ range }`: a `[from, to]` value: `field gte from` and `field lte to`,
  each half only when it's set.
- `{ presets }`: the value names presets, each one on or off.
- `{ rules: true }`: the value is a list of filters, each kept as it is.

```ts
interface Preset
```

One named filter a field turns on or off: "Mine", "Updated this week". Its
`value` is what the field holds while it's on; its `filter` is what it adds
to the query's, an `all` of conditions or one condition.

| Member              | Type     | Default | Description                                                      |
| ------------------- | -------- | ------- | ---------------------------------------------------------------- |
| `value` (required)  | `string` |         | What the field holds for it: `'mine'`.                           |
| `label` (required)  | `string` |         | How it reads: `'Mine'`.                                          |
| `filter` (required) | `Filter` |         | What it adds while it's on: `{ field: 'assignee', op: 'isMe' }`. |

```ts
foldFilter(nodes: AnyNodes, values: Record<string, unknown>, options?: FilterOptions): FilterQuery
```

Folds a filter form's field values into the query's `{ search, filter }`.
The field named `search` becomes `search`, left out when it's `''`. Each
field with a `filter` writes into one `{ all: [...] }`:

- `{ op }`: `{ field, op, value }`, unless the value is its kind's empty one
  (`''`, `null`, `[]`, `false`) or `map` turns it to `null`. An operator
  that takes no operand (`empty`, `notEmpty`, `isMe`) writes `{ field, op }`
  while the value isn't empty.
- `{ range }`: a condition for each half that's set.
- `{ presets }`: the filter of each preset that's on, an `all` spread into
  the list.
- `{ rules }`: each entry as it is.

The same condition is written once. Only the fields `values` holds write,
so a field `when` hides writes nothing when it's given the visible values,
as `onCommit` and `onSubmit` hand them. `options.operators` says which
take no operand: bh's fifteen when it's left out.

| Parameter           | Type                                           | Default | Description                                                                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nodes` (required)  | `AnyNodes`                                     |         |                                                                                                                                                                                                                                                                                           |
| `values` (required) | `Record<string, unknown>`                      |         |                                                                                                                                                                                                                                                                                           |
| `options`           | `FilterOptions`                                | `{}`    |                                                                                                                                                                                                                                                                                           |
| `options.operators` | `OperatorRegistry`                             |         | The operators, for which take no operand: bh's fifteen when it's left out.                                                                                                                                                                                                                |
| `options.emptyOf`   | `(field: FieldNode<InputRegistry>) => unknown` |         | A field's empty value: the registry's `defaultValue` for its type. It says what a field holds when the filter sets nothing of it, and whether a presets field holds a list or one preset. Left out, a field the filter sets nothing of is left out too, and a presets field holds a list. |

Returns `FilterQuery`.

```ts
spreadFilter(nodes: AnyNodes, value: { search?: string; filter?: Filter }, options?: FilterOptions): SpreadFilter
```

Puts a `{ search, filter }` value back onto a filter form's fields: each
condition of the value's `all` shows in every field it matches.

- An `{ op }` field with the same field and operator takes its value,
  through `map` reversed (a key `'true'` or `'false'` comes back a
  boolean); one holding a condition whose operator takes no operand is on
  (`true`). Each takes the first condition it matches.
- A `{ range }` field takes either half.
- A preset is on when every condition of its filter is in the value. A
  field holding one preset, as a segmented does, takes the one with the
  most conditions, the first of them on a tie, a preset of none (`{ all:
[] }`) only when no other is on.
- A condition nothing takes, and any `any` or `not` group, goes to the
  `{ rules }` field; with no rules field, to `rest`, which a filter form
  folds back unchanged. A value that isn't an `all` is one entry of `rest`.

A field that took a condition and is shown by a `when` of another field's
value (`{ field: 'show', eq: 'by-person' }`) sets that field, unless it
took a condition of its own, so the condition stays in view. The field
named `search` takes the value's `search`. A field the value sets nothing
of holds its map's key for `null` (no condition), else its empty value
(`options.emptyOf`).

| Parameter           | Type                                           | Default | Description                                                                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nodes` (required)  | `AnyNodes`                                     |         |                                                                                                                                                                                                                                                                                           |
| `value` (required)  | `{ search?: string; filter?: Filter }`         |         |                                                                                                                                                                                                                                                                                           |
| `options`           | `FilterOptions`                                | `{}`    |                                                                                                                                                                                                                                                                                           |
| `options.operators` | `OperatorRegistry`                             |         | The operators, for which take no operand: bh's fifteen when it's left out.                                                                                                                                                                                                                |
| `options.emptyOf`   | `(field: FieldNode<InputRegistry>) => unknown` |         | A field's empty value: the registry's `defaultValue` for its type. It says what a field holds when the filter sets nothing of it, and whether a presets field holds a list or one preset. Left out, a field the filter sets nothing of is left out too, and a presets field holds a list. |

Returns `SpreadFilter`.

```ts
dropShared(nodes, values, change, options?): Record<string, unknown>
```

Lets every field go of a condition one field just dropped, so removing a
condition from one field removes it from all. Run on each commit: when the
committed field's new value no longer writes a condition its old value
wrote, every other field holding that condition lets it go. A preset turns
off (a field holding one preset goes to the one that sets nothing, as an
"All", else to none), an `{ op }` field takes its value for no condition, a
range the half, and the `rules` list loses it.

Turning presets off in a field holding a list of them lets go of all their
conditions, so another preset of the field holding one turns off too.
Unpicking Blocked in the status chips turns a "Blocked" preset off too.
Returns the values, a new object when anything let go.

| Parameter           | Type                                           | Default | Description                                                                                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nodes` (required)  | `AnyNodes`                                     |         |                                                                                                                                                                                                                                                                                           |
| `values` (required) | `Record<string, unknown>`                      |         |                                                                                                                                                                                                                                                                                           |
| `change` (required) | `CommitChange`                                 |         |                                                                                                                                                                                                                                                                                           |
| `options`           | `FilterOptions`                                | `{}`    |                                                                                                                                                                                                                                                                                           |
| `options.operators` | `OperatorRegistry`                             |         | The operators, for which take no operand: bh's fifteen when it's left out.                                                                                                                                                                                                                |
| `options.emptyOf`   | `(field: FieldNode<InputRegistry>) => unknown` |         | A field's empty value: the registry's `defaultValue` for its type. It says what a field holds when the filter sets nothing of it, and whether a presets field holds a list or one preset. Left out, a field the filter sets nothing of is left out too, and a presets field holds a list. |

Returns `Record<string, unknown>`.

```ts
narrowOf<I extends InputRegistry, L extends LayoutComponentRegistry>(form, keep): NarrowForms<I, L>
```

Splits a filter form for a narrow window, by the names of the fields its
bar keeps. The bar keeps those fields and the rest of its nodes, in place,
and puts the `sheet` slot where the first moved field was; it loses its
submit, since it applies at once. The sheet holds the moved fields, in
their order and out of their layouts, so the registry's own field wrapper
draws them with their labels above; then the config's reset, and its
submit or one labelled `'Show {count} items'`.

| Parameter         | Type                | Default | Description |
| ----------------- | ------------------- | ------- | ----------- |
| `form` (required) | `FormConfig<I, L>`  |         |             |
| `keep` (required) | `readonly string[]` |         |             |

Returns `NarrowForms<I, L>`.

```ts
interface NarrowForms<I extends InputRegistry, L extends LayoutComponentRegistry>
```

A filter form split for a narrow window: a bar, and a sheet of the fields it doesn't keep.

| Member             | Type               | Default | Description                                                                                                                             |
| ------------------ | ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `bar` (required)   | `FormConfig<I, L>` |         | The kept fields and the rest of the nodes, less a submit, with the `sheet` slot where the first moved field was: it applies at once.    |
| `sheet` (required) | `FormConfig<I, L>` |         | The moved fields, in their order, then the config's reset and its submit, or one labelled `'Show {count} items'`: it applies on submit. |

```ts
interface FilterOptions
```

What folding and spreading a filter take besides the nodes and the value.

| Member      | Type                                           | Default | Description                                                                                                                                                                                                                                                                               |
| ----------- | ---------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `operators` | `OperatorRegistry`                             |         | The operators, for which take no operand: bh's fifteen when it's left out.                                                                                                                                                                                                                |
| `emptyOf`   | `(field: FieldNode<InputRegistry>) => unknown` |         | A field's empty value: the registry's `defaultValue` for its type. It says what a field holds when the filter sets nothing of it, and whether a presets field holds a list or one preset. Left out, a field the filter sets nothing of is left out too, and a presets field holds a list. |

## Types

From [`@bh/resource`](../../../shared/resource/docs/contract.md):

```ts
import type { RegistryOf } from '@bh/registry';

/** A registered operator's name: one of bh's fifteen or an app's own. */
export type Operator = string;

/** A field's key, or an option field's key, a dot and one of its attributes: 'status.kind'. */
export type FieldPath = string;

/** One value: text, a finite number, or a boolean. */
export type Scalar = string | number | boolean;

/** Which rows: conditions on their fields, joined by all, any and not. */
export type Filter = { all: Filter[] } | { any: Filter[] } | { not: Filter } | Condition;

/** One field, one operator, and what it compares with; no value for an operator that takes none. */
export interface Condition {
  field: FieldPath;
  op: Operator;
  value?: Scalar | Scalar[];
}

/** What GET /api/<resource>/meta answers: a filter form reads its label and fields. */
export interface ResourceMeta {
  resource: string;
  label: { one: string; other: string };
  fields: FieldMeta[];
  // …its roles, sort, actions and what it serves
}

/** One field: what a filter form reads of it. */
export interface FieldMeta {
  key: string;
  label: string;
  type: { kind: string; settings?: Record<string, unknown>; many?: true };
  query: { filter: Operator[]; sort: boolean; group: boolean; search: boolean };
  // …its format, template and write
}

/** A registered operator: how it reads, and whether it takes an operand. */
export interface OperatorSpec {
  name: Operator;
  label: string;
  // …its other words, its operand's schema and `matches`
}

/** A registered kind: the operators a field of it may allow. */
export interface KindSpec {
  name: string;
  operators: Operator[];
  // …its value's schema, its settings, sort and group
}

/** The operators an app runs with, bh's and its own, by name: baseOperators, for one. */
export type OperatorRegistry = RegistryOf<OperatorSpec>;

/** The kinds an app runs with, bh's and its own, by name: baseKinds, for one. */
export type KindRegistry = RegistryOf<KindSpec>;
```

The whole of each is on [`@bh/resource`'s page](../../../shared/resource/docs/contract.md).
