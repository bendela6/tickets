import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import type { FieldMeta, Filter } from '@bh/resource';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

/** A field of a made-up crawler's runs, filterable by `filter`. */
function field(key: string, label: string, type: FieldMeta['type'], filter: string[]): FieldMeta {
  return {
    key,
    label,
    type,
    query: { filter, sort: true, group: false, search: false },
    write: { create: true, update: true, required: false },
  };
}

const FIELDS: FieldMeta[] = [
  field(
    'status',
    'Status',
    {
      kind: 'option',
      settings: {
        options: [
          { value: 'running', label: 'Running', color: 'blue', order: 0 },
          { value: 'done', label: 'Done', color: 'green', order: 1 },
          { value: 'failed', label: 'Failed', color: 'red', order: 2 },
        ],
      },
    },
    ['equals', 'in', 'notIn'],
  ),
  field('pages', 'Pages', { kind: 'number' }, ['lt', 'gte']),
  field('started', 'Started', { kind: 'date' }, ['inLast', 'gt']),
  field('site', 'Site', { kind: 'text' }, ['contains', 'startsWith']),
];

const form = defineForm(registry).build((b) => {
  return [b.rules({ name: 'rules', label: 'Filters', config: { add: 'panel', fields: FIELDS } })];
});

export function RulesPanel() {
  const [rules, setRules] = useState<Filter[]>([{ field: 'pages', op: 'gte', value: 100 }]);
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-640 flex-col gap-12">
        <Form
          form={form}
          values={{ rules }}
          onCommit={(_, now) => {
            setRules(now.rules as Filter[]);
          }}
        />
        <pre className="text-12 text-gray-11 font-mono break-all whitespace-pre-wrap">
          {JSON.stringify({ all: rules })}
        </pre>
      </div>
    </FormProvider>
  );
}
