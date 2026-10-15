---
title: FilterSheet
summary: "A filter form's fields on a phone: a Filters button that opens a sheet
  from the bottom."
related: [FilterCount, InlineFieldWrapper, Drawer]
---

[//]: # 'written from filter-sheet.doc.yaml by pnpm docs:sync; edit that file, not this one'

# FilterSheet

A filter form's fields on a phone: a 44-pixel Filters button, with how
many conditions they hold on its badge, that opens a
[Drawer](../../../overlays/components/drawer/drawer.md) from the bottom. It is the
registry's `filter.sheet` ([The registry](../../../../../../form/docs/registry.md)): below the
width its `inline` layout's `narrow` names, a filter form keeps a few
fields in its bar and gives the rest to the sheet, as a form of their
own over the same value.

## Import

```tsx
import { FilterSheet } from '@bh/ui';
```

## Examples

The sheet has a grabber, its title and a Close button, then its form,
which scrolls inside it. The form's buttons, an `actions` row, stay at
the sheet's foot as the fields scroll under them. The sheet is
portaled, so its form isn't nested in the bar's, though the bar holds
the button.

**On a phone**

```tsx
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
```

## Keyboard and accessibility

The button says how many conditions there are, "Filters, 3 filters",
and opens a modal dialog named by the title. Escape, the dim and Close
shut it, and the focus goes back to the button.

## Props

| Prop                      | Type                      | Default | Description                                                                  |
| ------------------------- | ------------------------- | ------- | ---------------------------------------------------------------------------- |
| `title` (required)        | `string`                  |         | The sheet's title: "Filters".                                                |
| `count` (required)        | `number`                  |         | How many conditions the sheet's fields hold, on its button's badge.          |
| `open` (required)         | `boolean`                 |         | Whether the sheet is open.                                                   |
| `onOpenChange` (required) | `(open: boolean) => void` |         | Called with the new open state: from its button, Escape, or its own buttons. |
| `children` (required)     | `ReactNode`               |         | The sheet's own form: its fields, then its buttons.                          |
