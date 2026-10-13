---
title: Instrument's bindings
summary: The inputs, layouts, wrappers and button @bh/ui registers, what each
  kind holds, and what its config takes.
order: 9
related: [The registry, Writing an input, FieldWrapper]
---

[//]: # 'written from bindings.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Instrument's bindings

The inputs, layouts, wrappers and button `@bh/ui` registers, what each kind of
field holds, and what its config takes.

## Import

```tsx
import { baseInputs, baseLayouts, FieldWrapper, FormButton, RootWrapper } from '@bh/ui';
```

`baseInputs` and `baseLayouts` are a registry's `inputs` and `layouts`;
`FieldWrapper`, `RootWrapper` and `FormButton` its `field`, `root` and `action`
([The registry](registry.md)). Spread `baseInputs` to add kinds of
your own.

## Inputs

One kind per control, each drawing the component it names. Its value is
what the form holds for it, and empty is where a field of it starts.

| Kind             | Control                                                                                           | Value                              | Empty          | Config                                     |
| ---------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------- | ------------------------------------------ |
| `text`           | [Input](../../ui/src/library/inputs/components/input/input.md)                                    | `string`                           | `''`           | `placeholder`, `mono`, `prefix`, `commit`  |
| `email`          | [Input](../../ui/src/library/inputs/components/input/input.md), `type="email"`                    | `string`                           | `''`           | `placeholder`, `commit`                    |
| `textarea`       | [Textarea](../../ui/src/library/inputs/components/textarea/textarea.md)                           | `string`                           | `''`           | `rows`, `placeholder`, `commit`            |
| `number`         | [NumberInput](../../ui/src/library/inputs/components/number-input/number-input.md)                | `number \| null`                   | `null`         | `min`, `max`, `step`, `suffix`, `commit`   |
| `select`         | [Combobox](../../ui/src/library/inputs/components/combobox/combobox.md)                           | `string \| null`                   | `null`         | `options`, `placeholder`                   |
| `multi-select`   | [MultiCombobox](../../ui/src/library/inputs/components/multi-combobox/multi-combobox.md)          | `string[]`                         | `[]`           | `options`, `placeholder`, `maxChips`       |
| `radio`          | [RadioGroup](../../ui/src/library/inputs/components/radio-group/radio-group.md)                   | `string`                           | `''`           | `options`, `variant`, `label`              |
| `segmented`      | [SegmentedControl](../../ui/src/library/inputs/components/segmented-control/segmented-control.md) | `string`                           | `''`           | `options`, `label`                         |
| `checkbox-group` | [CheckboxGroup](../../ui/src/library/inputs/components/checkbox-group/checkbox-group.md)          | `string[]`                         | `[]`           | `options`, `label`, `selectAllLabel`       |
| `toggle`         | [Switch](../../ui/src/library/inputs/components/switch/switch.md)                                 | `boolean`                          | `false`        | `label`                                    |
| `checkbox`       | [Checkbox](../../ui/src/library/inputs/components/checkbox/checkbox.md)                           | `boolean`                          | `false`        | `label`                                    |
| `date`           | [DatePicker](../../ui/src/library/inputs/components/date-picker/date-picker.md)                   | `string \| null`, `yyyy-mm-dd`     | `null`         | `placeholder`, `min`, `max`                |
| `date-range`     | [DateRangePicker](../../ui/src/library/inputs/components/date-range-picker/date-range-picker.md)  | `[string \| null, string \| null]` | `[null, null]` | `placeholder`                              |
| `time`           | [TimePicker](../../ui/src/library/inputs/components/time-picker/time-picker.md)                   | `string \| null`, `HH:MM`          | `null`         | `stepMinutes`, `placeholder`               |
| `duration`       | [DurationInput](../../ui/src/library/inputs/components/duration-input/duration-input.md)          | `number \| null`, in minutes       | `null`         | `placeholder`, `budgetMinutes`             |
| `slider`         | [Slider](../../ui/src/library/inputs/components/slider/slider.md)                                 | `number`                           | `0`            | `min`, `max`, `step`, `label`, `valueText` |
| `range`          | [RangeSlider](../../ui/src/library/inputs/components/range-slider/range-slider.md)                | `[number, number]`                 | `[0, 100]`     | `min`, `max`, `step`, `label`              |
| `rating`         | [Rating](../../ui/src/library/inputs/components/rating/rating.md)                                 | `number`, `0` unrated              | `0`            | `max`, `label`, `showValue`                |
| `tags`           | [TagInput](../../ui/src/library/inputs/components/tag-input/tag-input.md)                         | `string[]`                         | `[]`           | `suggestions`, `placeholder`               |
| `password`       | [PasswordInput](../../ui/src/library/inputs/components/password-input/password-input.md)          | `string`                           | `''`           | `placeholder`, `commit`                    |
| `pin`            | [PinInput](../../ui/src/library/inputs/components/pin-input/pin-input.md)                         | `string`, the whole code           | `''`           | `length`                                   |
| `color`          | [ColorPicker](../../ui/src/library/inputs/components/color-picker/color-picker.md)                | `string \| null`, a hue's name     | `null`         | `placeholder`, `label`                     |
| `icon`           | [IconPicker](../../ui/src/library/inputs/components/icon-picker/icon-picker.md)                   | `string \| null`, an icon's name   | `null`         | `placeholder`, `icons`                     |
| `user`           | [UserPicker](../../ui/src/library/inputs/components/user-picker/user-picker.md)                   | `string[]`, people's ids           | `[]`           | `people`, `multiple`, `placeholder`        |
| `file`           | [FileInput](../../ui/src/library/inputs/components/file-input/file-input.md)                      | `UploadFile[]`                     | `[]`           | `accept`, `multiple`, `onSelect`           |
| `json`           | [Textarea](../../ui/src/library/inputs/components/textarea/textarea.md), parsed as you type       | `string`, the text itself          | `''`           | `rows`, `placeholder`                      |
| `list`           | a form per item                                                                                   | `Record<string, unknown>[]`        | `[]`           | `item`, `itemLabel`                        |
| `object`         | a form inside the form                                                                            | `Record<string, unknown> \| null`  | `null`         | `fields`                                   |

`select`, `multi-select`, `radio`, `segmented`, `checkbox-group` and
`user` are disabled while their config [loads](async-options.md).
`InputKind` names every kind, and `ValueOfKind` what each one holds.

`commit`, in the config of `text`, `email`, `password`, `textarea` and
`number`, says when the field hands what you type to the form:
`'change'` (the default) at every keystroke, `'leave'` on Enter and on
leaving the field, `{ after: 800 }` on those and after a pause. Until
then the field holds a draft, and the form's value is the last one
committed.

A `<label for>` names one element, and `radio`, `segmented`,
`checkbox-group`, `rating`, `slider` and `range` are drawn as groups or
on a div, which it cannot name. Those take the field's label as their
accessible name instead; a `label` in their config names them in its
place.

## Two kinds for one value

`toggle` and `checkbox` both hold a boolean, and `radio`, `segmented`
and `select` one string. Which one a form uses is a decision a stored
form records: a switch reads as taking effect at once, a checkbox as a
value saved with the form; a radio group shows every option, a select
keeps them behind a trigger. Search has no kind: it filters a view, and a
form has nothing to keep of it.

## Lists and objects

A `list` holds any number of objects of one shape, its `item` the form
of one; Add puts a new one at the end, filled with its fields' defaults,
and each moves up and down and comes out. An `object` holds one, its
`fields` the form of it. Both draw their fields with the form's own
registry.

**Lists and objects**

```tsx
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
```

## Layouts

| Kind      | Props                  | Draws                                                                                               |
| --------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| `card`    | `title`, `description` | A [Card](../../ui/src/library/layout/components/card/card.md) with its title in a header, an `<h3>` |
| `group`   | `title`, `description` | A rule and a caption, an `<h4>`, and no surface: a part of a card                                   |
| `row`     | none                   | Its fields side by side once it is 760 pixels wide, stacked below that                              |
| `column`  | none                   | Its fields stacked, spaced as the form's own                                                        |
| `actions` | none                   | Its buttons side by side at their own widths, a little below the fields                             |

## Wrappers

[FieldWrapper](../../ui/src/library/forms/components/field-wrapper/field-wrapper.md) draws a field's label,
its input, and its help or its problem; the label sits beside the field
once the field is 520 pixels wide, above it below that. `RootWrapper`
spaces the form's top-level fields. `FormButton` draws a submit as a solid
[Button](../../ui/src/library/primitives/components/button/button.md) that shows the submit running,
and a reset as a ghost one.

## Rules

- A kind's name is stored with every form that uses it: renaming one is
  a migration of that data.
- A kind's empty value is one its control can draw: a field never
  starts undefined.
- A field's problem shows once the field has been left or a submit
  tried, and `touched` says which fields have been left. The field
  wrapper draws whatever problem it is given.

## Reference

```ts
type InputKind = keyof typeof baseInputs;
```

The kinds a FormConfig may name — the vocabulary anything GENERATING one has
to speak.

This is the seam the table engine joins at. `propsToForm` picks a kind per
column and emits a FormConfig; the form layer resolves it through
`baseInputs` and never learns which control it ended up rendering. Derived
from the registry rather than restated, so a kind cannot be added to one
without the other.

These strings are serialised into stored FormConfigs, so renaming one is a
data migration, not a refactor.

One of `'number'`, `'object'`, `'duration'`, `'select'`, `'color'`, `'text'`, `'icon'`, `'file'`, `'user'`, `'list'`, `'textarea'`, `'time'`, `'checkbox'`, `'radio'`, `'slider'`, `'toggle'`, `'email'`, `'multi-select'`, `'date'`, `'json'`, `'password'`, `'pin'`, `'segmented'`, `'checkbox-group'`, `'tags'`, `'rating'`, `'range'`, `'date-range'`.

```ts
interface ValueOfKind
```

What a field of each kind holds — the other half of the contract, and the
half a type cannot infer from `defaultValue` alone (`null` is both an empty
number and an empty select).

Nullability is meaning here, not style: a number field can be empty where a
toggle cannot, and a multi-select uses `[]` rather than null so "nothing
selected" has exactly one spelling.

| Member                      | Type                               | Default | Description                                                                                                                                   |
| --------------------------- | ---------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `text` (required)           | `string`                           |         |                                                                                                                                               |
| `email` (required)          | `string`                           |         | The address as typed: the field's schema checks it.                                                                                           |
| `textarea` (required)       | `string`                           |         |                                                                                                                                               |
| `number` (required)         | `number \| null`                   |         |                                                                                                                                               |
| `select` (required)         | `string \| null`                   |         |                                                                                                                                               |
| `multi-select` (required)   | `string[]`                         |         |                                                                                                                                               |
| `radio` (required)          | `string`                           |         | `''` is "nothing chosen" — a radio group is never null, it is unselected.                                                                     |
| `toggle` (required)         | `boolean`                          |         |                                                                                                                                               |
| `checkbox` (required)       | `boolean`                          |         |                                                                                                                                               |
| `date` (required)           | `string \| null`                   |         | ISO `yyyy-mm-dd`. A calendar day has no time and no zone; a `Date` has both.                                                                  |
| `slider` (required)         | `number`                           |         | Never null: a thumb is always somewhere, so an empty slider would render a position and lie about it. A number that can be empty is `number`. |
| `json` (required)           | `string`                           |         |                                                                                                                                               |
| `password` (required)       | `string`                           |         |                                                                                                                                               |
| `pin` (required)            | `string`                           |         | The whole code, not one value per cell.                                                                                                       |
| `segmented` (required)      | `string`                           |         |                                                                                                                                               |
| `checkbox-group` (required) | `string[]`                         |         |                                                                                                                                               |
| `tags` (required)           | `string[]`                         |         | Free text, so these are the values themselves rather than ids into a list.                                                                    |
| `rating` (required)         | `number`                           |         | 0 is unrated — a real answer, which is why this is not nullable.                                                                              |
| `range` (required)          | `[number, number]`                 |         | Two thumbs are always somewhere, so a range is never null.                                                                                    |
| `date-range` (required)     | `[string \| null, string \| null]` |         | Either half may be null: a half-picked range is a real state to hold.                                                                         |
| `time` (required)           | `string \| null`                   |         | `HH:MM`, a clock reading.                                                                                                                     |
| `duration` (required)       | `number \| null`                   |         | MINUTES, a length. Looks like `time` and means something else entirely.                                                                       |
| `color` (required)          | `string \| null`                   |         | A hue name from the eleven ramps.                                                                                                             |
| `icon` (required)           | `string \| null`                   |         | An icon name from the registry.                                                                                                               |
| `user` (required)           | `string[]`                         |         | Person ids, in both single and multi mode.                                                                                                    |
| `file` (required)           | `UploadFile[]`                     |         |                                                                                                                                               |
| `list` (required)           | `Record<string, unknown>[]`        |         | Each item an object of its own fields' values.                                                                                                |
| `object` (required)         | `Record<string, unknown> \| null`  |         | Null until a field in it is given a value.                                                                                                    |

| Prop                  | Type        | Default | Description                                                                                                                         |
| --------------------- | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `name` (required)     | `string`    |         | The field's name in the form's values.                                                                                              |
| `label`               | `string`    |         | The field's label, from its definition.                                                                                             |
| `description`         | `string`    |         | Help text for the field, from its definition.                                                                                       |
| `required` (required) | `boolean`   |         | Whether the field is required, from its definition.                                                                                 |
| `error`               | `string`    |         | The field's problem: its validation message, once the field has been left or a submit tried, or why its last commit failed to save. |
| `descriptionId`       | `string`    |         | The id for the element that holds `description`, which the input is described by.                                                   |
| `errorId`             | `string`    |         | The id for the element that holds `error`, or `configError`'s message: the input is described by it in the help's place.            |
| `touched` (required)  | `boolean`   |         | Whether the reader has left the field yet.                                                                                          |
| `loading` (required)  | `boolean`   |         | Whether the field's config is still resolving, as while its options load.                                                           |
| `configError`         | `Error`     |         | Why the field's config failed to resolve, if it did.                                                                                |
| `saving`              | `boolean`   |         | Whether the field's last commit is still being saved by the form's `onCommit`.                                                      |
| `children` (required) | `ReactNode` |         | The field's input, drawn from the registry.                                                                                         |

| Prop                  | Type        | Default | Description                                   |
| --------------------- | ----------- | ------- | --------------------------------------------- |
| `children` (required) | `ReactNode` |         | The form's fields and layouts, already drawn. |

| Prop                  | Type                                | Default | Description                                                                            |
| --------------------- | ----------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `action` (required)   | `FormAction`: `'submit'`, `'reset'` |         | What it does: submit the form, or put its values back where they started.              |
| `label` (required)    | `string`                            |         | Its text, from the node.                                                               |
| `disabled` (required) | `boolean`                           |         | A reset with nothing to put back, and either while a submit runs.                      |
| `loading` (required)  | `boolean`                           |         | A submit running: the submit button shows it.                                          |
| `onClick`             | `() => void`                        |         | A reset's: puts the values back. A submit is a `type="submit"` button, and needs none. |
