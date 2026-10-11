import { useState } from 'react';
import { defineForm, defineRegistry, Form, FormProvider } from '@bh/form';
import { baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
  action: { Component: FormButton },
});

const report = defineForm(registry).build((b) => {
  return [
    b.text({
      name: 'title',
      label: 'Title',
      config: {},
    }),
    b.number({
      name: 'pages',
      label: 'Pages',
      defaultValue: 1,
      config: { min: 1 },
    }),
    b.tags({
      name: 'labels',
      label: 'Labels',
      config: { placeholder: 'Add a label' },
    }),
    b.actions({}, [b.submit({ label: 'Submit' })]),
  ];
});

export function StartingValues() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-360 flex-col gap-12">
        <Form form={report} defaultValues={{ title: 'Quarterly report' }} onSubmit={setSent} />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
