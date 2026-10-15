import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import type { FieldMeta, Filter } from '@bh/resource';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

/** A field of a made-up media library, filterable by `filter`. */
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
  field('size', 'Size', { kind: 'number' }, ['lt', 'gte']),
  field('title', 'Title', { kind: 'text' }, ['contains']),
  field('starred', 'Starred', { kind: 'boolean' }, ['equals']),
  field('uploaded', 'Uploaded', { kind: 'date' }, ['inLast']),
];

const RULES: Filter[] = [
  { field: 'size', op: 'gte', value: 100 },
  { field: 'title', op: 'contains', value: 'trailer' },
  { field: 'starred', op: 'equals', value: true },
  { field: 'uploaded', op: 'inLast', value: 30 },
];

/** The same row three ways, each 375 pixels wide. */
const ROWS = [
  ['wrap', 'wrap'],
  ['scroll', 'scroll'],
  ['{ collapse: 2 }', { collapse: 2 }],
] as const;

export function InlineOverflow() {
  return (
    <FormProvider registry={registry}>
      <div className="flex flex-col gap-16">
        {ROWS.map(([name, overflow]) => {
          const form = defineForm(registry).build((b) => {
            return [
              b.inline({ overflow }, [
                b.search({ name: 'search', label: 'Search', config: { placeholder: 'Search' } }),
                b.rules({ name: 'rules', label: 'Filters', config: { fields: FIELDS } }),
              ]),
            ];
          });
          return (
            <div key={name} className="flex flex-col gap-6">
              <code className="text-12 text-gray-11 font-mono">overflow: {name}</code>
              <div className="border-gray-6 rounded-6 border-1.5 w-375 max-w-full p-10">
                <Form form={form} values={{ rules: RULES }} />
              </div>
            </div>
          );
        })}
      </div>
    </FormProvider>
  );
}
