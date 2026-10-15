---
title: InlineFieldWrapper
summary: 'Draws one field in a row, as a filter bar lays its fields out: the
  label inside the control, before it, or for a screen reader only.'
related: [FieldWrapper, SegmentedControl, SearchInput]
---

[//]: # 'written from inline-field-wrapper.doc.yaml by pnpm docs:sync; edit that file, not this one'

# InlineFieldWrapper

Draws one field in a row, at its own width, as a filter bar lays its
fields out. It is the field wrapper of the registry's `inline` layout,
so every field inside an `inline` node gets it in place of the
registry's `field` ([Instrument's bindings](../../../../../../form/docs/bindings.md#layouts)).
A form laid out the usual way keeps
[FieldWrapper](../field-wrapper/field-wrapper.md), with its label above.

## Import

```tsx
import { InlineFieldWrapper, useInlineField } from '@bh/ui';
```

## Examples

Where the label goes depends on the field's kind, which the form gives
it as `type`. A `select`, `multi-select`, `date`, `date-range` or
`user` field draws it inside its trigger, muted, and reads its
placeholder while empty: "Kind: any". A control whose options or
placeholder say what it is (a `search`, `toggle-chips`, `segmented`,
`tabs`, `avatars` or `rules` field) is named by the label for a screen
reader only. A `checkbox` or `toggle` field draws it as the text beside
its box, unless its config gives that text: it names the box. Any other
kind has the label before it, muted: "Updated in the last [7] days". The controls take the 30-pixel rung; a `search`
field grows to fill what the row leaves, from 160 pixels, a `text` box
is 160 pixels wide and a `number` 80.

**A filter row**

```tsx
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
```

There is no room under a control in a row, so a problem shows beside
it, in a tooltip's look, for as long as it lasts; a `configError` comes
before an `error`, as in FieldWrapper. While `saving`, a small spinner
follows the control. The description is read with the control, not
shown.

**A problem and a save**

```tsx
import { InlineFieldWrapper, NumberInput } from '@bh/ui';

export function AProblemAndASave() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <InlineFieldWrapper
        name="days"
        type="number"
        label="Updated in the last"
        error="At most 366 days."
        errorId="days-problem"
        required={false}
        touched
        loading={false}
      >
        <NumberInput
          id="days"
          value={400}

          tone="danger"
          aria-describedby="days-problem"
          onChange={() => {}}
        />
      </InlineFieldWrapper>
      <InlineFieldWrapper
        name="size"
        type="number"
        label="At least"
        saving
        required={false}
        touched={false}
        loading={false}
      >
        <NumberInput id="size" value={3} onChange={() => {}} />
      </InlineFieldWrapper>
    </div>
  );
}
```

## What a control in a row is told

`useInlineField()` tells the control inside the wrapper the size a
control in a row takes, `xs`, 30 pixels, and, for a kind that draws the
label itself, as its trigger's muted prefix ("Type: any") or as the text
beside its box, the label. Outside an `InlineFieldWrapper` it gives undefined: the control
keeps its own size, and the label is the wrapper's to draw.

```ts
interface InlineField {
  /** The label the control draws itself: inside its trigger, or beside its box. */
  label?: string;
  /** The size a control in a row takes: 'xs'. */
  size: 'xs' | 'md' | 'lg';
}
```

## Keyboard and accessibility

The label is a `<label>` for `name`, so it names the control whose `id`
is `name`, shown or not. The problem takes `errorId` and the
description `descriptionId`, and a form points the control's
`aria-describedby` at whichever is drawn; a control in the danger tone
sets `aria-invalid`. The spinner is a `role="status"` that says
"Saving".

## Props

| Prop                  | Type        | Default | Description                                                                                                                                   |
| --------------------- | ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `name` (required)     | `string`    |         | The field's name in the form's values.                                                                                                        |
| `type`                | `string`    |         | The field's kind, as its input is registered: 'select', 'search'. A wrapper may place the label its own way per kind, as a filter bar's does. |
| `label`               | `string`    |         | The field's label, from its definition.                                                                                                       |
| `description`         | `string`    |         | Help text for the field, from its definition.                                                                                                 |
| `required` (required) | `boolean`   |         | Whether the field is required, from its definition.                                                                                           |
| `error`               | `string`    |         | The field's problem: its validation message, once the field has been left or a submit tried, or why its last commit failed to save.           |
| `descriptionId`       | `string`    |         | The id for the element that holds `description`, which the input is described by.                                                             |
| `errorId`             | `string`    |         | The id for the element that holds `error`, or `configError`'s message: the input is described by it in the help's place.                      |
| `touched` (required)  | `boolean`   |         | Whether the reader has left the field yet.                                                                                                    |
| `loading` (required)  | `boolean`   |         | Whether the field's config is still resolving, as while its options load.                                                                     |
| `configError`         | `Error`     |         | Why the field's config failed to resolve, if it did.                                                                                          |
| `saving`              | `boolean`   |         | Whether the field's last commit is still being saved by the form's `onCommit`.                                                                |
| `children` (required) | `ReactNode` |         | The field's input, drawn from the registry.                                                                                                   |
