import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

// An `inline` row gives its fields InlineFieldWrapper: the search box is
// named for a screen reader only and grows, the select has its label inside,
// and the number has its label before it.
const form = defineForm(registry).build((b) => {
  return [
    b.inline({}, [
      b.search({ name: 'search', label: 'Search', config: { placeholder: 'Search titles' } }),
      b.segmented({
        name: 'kind',
        label: 'Kind',
        config: {
          size: 'xs',
          placeholder: 'Any',
          options: [
            { value: 'video', label: 'Video' },
            { value: 'audio', label: 'Audio' },
          ],
        },
      }),
      b.select({
        name: 'owner',
        label: 'Owner',
        config: {
          placeholder: 'any',
          options: [
            { value: 'nino', label: 'Nino' },
            { value: 'luka', label: 'Luka' },
          ],
        },
      }),
      b.number({
        name: 'days',
        label: 'Updated in the last',
        config: { min: 1, suffix: 'days' },
      }),
    ]),
  ];
});

export function AFilterRow() {
  const [values, setValues] = useState<Record<string, unknown>>({ days: 7 });
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-720 flex-col gap-12">
        <Form form={form} values={values} onCommit={(_, now) => setValues(now)} />
        <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(values)}</pre>
      </div>
    </FormProvider>
  );
}
