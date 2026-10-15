import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, Button, FieldWrapper, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
});

const filters = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'title',
      label: 'Title',
      config: { commit: 'leave' },
    }),
    b.segmented({
      name: 'status',
      label: 'Status',
      config: {
        options: [
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' },
        ],
      },
    }),
  ];
});

// The page holds the value, as an address would: the form follows it, and
// tells the page of each change it commits.
export function ValuesFromOutside() {
  const [value, setValue] = useState<Record<string, unknown>>({ title: '', status: 'open' });
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form
          form={filters}
          values={value}
          onCommit={(_, values) => setValue((now) => ({ ...now, ...values }))}
        />
        <div className="flex gap-8">
          <Button variant="ghost" onClick={() => setValue({ title: '', status: 'closed' })}>
            Back to closed
          </Button>
        </div>
        <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(value)}</pre>
      </div>
    </FormProvider>
  );
}
