---
title: CheckboxGroup
summary: Several independent choices, all visible, held as one array of values.
related: [Checkbox, RadioGroup, ToggleChips, MultiCombobox]
---

[//]: # 'written from checkbox-group.doc.yaml by pnpm docs:sync; edit that file, not this one'

# CheckboxGroup

Several independent choices, all visible, held as one array of values.

It draws a [Checkbox](../checkbox/checkbox.md) for each of `options`
inside a `<fieldset>`. `label` is required and becomes the `<legend>`,
because a fieldset can't be named from outside.

## Import

```tsx
import { CheckboxGroup } from '@bh/ui';
```

## Examples

`value` is the chosen options' values; a click adds one to the array or
takes it out.

**Controlled**

```tsx
import { useState } from 'react';
import { CheckboxGroup } from '@bh/ui';

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

export function Controlled() {
  const [value, setValue] = useState<string[]>(['banana']);
  return <CheckboxGroup label="Fruits" options={FRUITS} value={value} onChange={setValue} />;
}
```

An option's `description` is a line under its label, as a Checkbox's
`description` draws it. When any option has one, every label is set in
500, so the options still read as one list. Give the lines room with a
wider `gap` through `className`. The options are the `Option` every
control with a choice takes, and
[RadioGroup](../radio-group/radio-group.md) draws the line too.

**Described**

```tsx
import { useState } from 'react';
import { CheckboxGroup } from '@bh/ui';

const NOTICES = [
  { value: 'replies', label: 'Replies', description: 'When someone answers something you wrote.' },
  { value: 'mentions', label: 'Mentions', description: 'When someone names you in a comment.' },
  { value: 'digest', label: 'Weekly digest' },
];

export function Described() {
  const [value, setValue] = useState<string[]>(['mentions']);
  return (
    <CheckboxGroup
      label="Notices"
      className="max-w-320 gap-12"
      options={NOTICES}
      value={value}
      onChange={setValue}
    />
  );
}
```

`selectAllLabel` adds a parent box that checks and clears the whole group.
It shows a dash while only some boxes are on, and is checked when every
box that can be toggled is. The legend is read only by screen readers
unless `showLabel` shows it.

**Select all**

```tsx
import { useState } from 'react';
import { CheckboxGroup } from '@bh/ui';

const CITIES = [
  { value: 'lima', label: 'Lima' },
  { value: 'oslo', label: 'Oslo' },
  { value: 'paris', label: 'Paris' },
  { value: 'tokyo', label: 'Tokyo' },
];

export function SelectAll() {
  const [value, setValue] = useState<string[]>(['oslo']);
  return (
    <CheckboxGroup
      label="Cities"
      showLabel
      selectAllLabel="All cities"
      options={CITIES}
      value={value}
      onChange={setValue}
    />
  );
}
```

The parent leaves a `disabled` option as it was, on or off, both when it
checks the group and when it clears it: here `readme.md` stays on.

**Disabled option**

```tsx
import { useState } from 'react';
import { CheckboxGroup } from '@bh/ui';

const FILES = [
  { value: 'notes', label: 'notes.txt' },
  { value: 'photo', label: 'photo.jpg' },
  { value: 'report', label: 'report.pdf' },
  { value: 'readme', label: 'readme.md', disabled: true },
];

export function DisabledOption() {
  const [value, setValue] = useState<string[]>(['photo', 'readme']);
  return (
    <CheckboxGroup
      label="Files"
      selectAllLabel="All files"
      options={FILES}
      value={value}
      onChange={setValue}
    />
  );
}
```

`disabled` disables the fieldset, and every box in it. `readOnly`
instead keeps every box in the tab order and ignores clicks.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { CheckboxGroup } from '@bh/ui';

const COLOURS = [
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
];

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState<string[]>(['green']);
  return (
    <div className="flex gap-32">
      <CheckboxGroup
        label="Read-only"
        options={COLOURS}
        value={value}
        onChange={setValue}
        readOnly
      />
      <CheckboxGroup
        label="Disabled"
        options={COLOURS}
        value={value}
        onChange={setValue}
        disabled
      />
    </div>
  );
}
```

## Keyboard and accessibility

| Key     | Does                                                    |
| ------- | ------------------------------------------------------- |
| `Tab`   | Moves from box to box.                                  |
| `Space` | Toggles the focused box, unless the group is read-only. |

The `<fieldset>` is a group named by its `<legend>`, so a screen reader
announces `label` on entering it, shown or not. `id` goes on the
fieldset. `readOnly` marks each box `aria-readonly`. A box whose option
has a `description` is named by its label alone and described by the
line.

## When not to use it

- For one choice among several, use
  [RadioGroup](../radio-group/radio-group.md).
- For a row of short options, like filters, use
  [ToggleChips](../toggle-chips/toggle-chips.md): the same array, as
  chips.
- To keep the options out of sight until asked for, use
  [MultiCombobox](../multi-combobox/multi-combobox.md): the same array,
  behind a field that opens.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options` (required)  | `Option[]`                                                                                                                                                                                                  |             | The choices, a box each, in the order given; a `disabled` option can't be toggled. An option's `description` goes under its label.                                            |
| `label` (required)    | `string`                                                                                                                                                                                                    |             | The group's name, rendered as its `<legend>`.                                                                                                                                 |
| `showLabel`           | `boolean`                                                                                                                                                                                                   | `false`     | Shows the legend, which is otherwise read only by screen readers.                                                                                                             |
| `selectAllLabel`      | `string`                                                                                                                                                                                                    |             | The label of a parent box, above the others, that checks and clears the whole group.                                                                                          |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `string[]`                                                                                                                                                                                                  |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                    |
| `onChange` (required) | `(value: string[], event?: SyntheticEvent) => void`                                                                                                                                                         |             | The new value — and, second, the event that produced it where one exists.                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   | `false`     | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   | `false`     | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                           |
