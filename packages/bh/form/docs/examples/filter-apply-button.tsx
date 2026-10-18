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
