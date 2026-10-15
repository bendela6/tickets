import { useState } from 'react';
import { defineForm, defineRegistry, Form } from '@bh/form';
import {
  baseInputs,
  baseLayouts,
  FieldWrapper,
  FilterSheet,
  FormButton,
  RootWrapper,
} from '@bh/ui';

const registry = defineRegistry({
  inputs: baseInputs,
  layouts: baseLayouts,
  field: { Component: FieldWrapper },
  root: { Component: RootWrapper },
  action: { Component: FormButton },
});

// The sheet's own form: the fields the bar has no room for, labels above,
// then its buttons, which the sheet keeps at its foot.
const form = defineForm(registry).build((b) => {
  return [
    b.select({
      name: 'type',
      label: 'Type',
      config: {
        placeholder: 'any',
        options: [
          { value: 'bug', label: 'Bug' },
          { value: 'feature', label: 'Feature' },
        ],
      },
    }),
    b.segmented({
      name: 'updated',
      label: 'Updated',
      config: {
        placeholder: 'Any',
        options: [
          { value: '1', label: 'Today' },
          { value: '7', label: '7 days' },
        ],
      },
    }),
    b.textarea({ name: 'note', label: 'Note', config: { rows: 6 } }),
    b.actions({}, [b.reset({ label: 'Clear', to: 'start' }), b.submit({ label: 'Show 12 items' })]),
  ];
});

export function OnAPhone() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({ type: 'bug' });
  return (
    <FilterSheet title="Filters" count={1} open={open} onOpenChange={setOpen}>
      <Form
        registry={registry}
        form={form}
        values={values}
        onSubmit={(next) => {
          setValues(next);
          setOpen(false);
        }}
      />
    </FilterSheet>
  );
}
