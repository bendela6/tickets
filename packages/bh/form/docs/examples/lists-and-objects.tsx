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

const page = defineForm(registry).build((b) => {
  return [
    b.list({
      name: 'links',
      label: 'Links',
      config: {
        itemLabel: 'Link',
        // One item's fields, as plain data: a list's items are forms of their own.
        item: {
          nodes: [
            { kind: 'field', name: 'label', type: 'text', label: 'Label', config: {} },
            {
              kind: 'field',
              name: 'url',
              type: 'text',
              label: 'Address',
              config: { prefix: 'https://' },
            },
          ],
        },
      },
    }),
    b.object({
      name: 'size',
      label: 'Size',
      config: {
        fields: {
          nodes: [
            { kind: 'field', name: 'width', type: 'number', label: 'Width', config: {} },
            { kind: 'field', name: 'height', type: 'number', label: 'Height', config: {} },
          ],
        },
      },
    }),
    b.actions({}, [b.submit({ label: 'Submit' })]),
  ];
});

export function ListsAndObjects() {
  const [sent, setSent] = useState<Record<string, unknown>>();
  return (
    <FormProvider registry={registry}>
      <div className="flex w-full max-w-400 flex-col gap-12">
        <Form form={page} onSubmit={setSent} />
        {sent ? <pre className="text-12 text-gray-11 font-mono">{JSON.stringify(sent)}</pre> : null}
      </div>
    </FormProvider>
  );
}
