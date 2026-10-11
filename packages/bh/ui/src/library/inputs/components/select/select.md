---
title: Select
summary: One choice from a short list, shown as plain text.
related: [Combobox, SegmentedControl, RadioGroup]
---

[//]: # 'written from select.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Select

One choice from a short list.

It opens a list and shows the chosen value as plain text, never a chip:
a Select holds exactly one value. An option with a `color` keeps a dot
before its label, because the colour is data.

## Import

```tsx
import { Select } from '@bh/ui';
```

## Examples

A `<label htmlFor>`, here `FieldLabel`, names it through `id`. While
`value` is `null`, `placeholder` stands in for it. A `disabled` option
stays in the list, and neither the cursor nor a click can pick it.

**With a label**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, Select, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'grape', label: 'Grape', disabled: true },
];

export function WithALabel() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>(null);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id}>Fruit</FieldLabel>
      <Select
        id={id}
        options={FRUITS}
        value={fruit}
        onChange={setFruit}
        placeholder="Choose a fruit"
      />
    </div>
  );
}
```

An option's `color` draws a dot before its label, on the field and in the
list. An option without one draws none.

**Coloured options**

```tsx
import { useState } from 'react';
import { Select, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple', color: 'red' },
  { value: 'banana', label: 'Banana', color: 'yellow' },
  { value: 'lime', label: 'Lime', color: 'green' },
  { value: 'plum', label: 'Plum', color: 'purple' },
];

export function ColouredOptions() {
  const [fruit, setFruit] = useState<string | null>('lime');
  return (
    <Select
      aria-label="Fruit"
      options={FRUITS}
      value={fruit}
      onChange={setFruit}
      className="w-256"
    />
  );
}
```

`size` steps the height, padding, radius and type together: 30, 38 and 46
pixels.

**Sizes**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, Select, type ControlSize, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

const SIZES: ControlSize[] = ['xs', 'md', 'lg'];

export function Sizes() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>('apple');
  return (
    <div className="flex w-288 flex-col gap-8">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex items-center gap-12">
            <FieldLabel htmlFor={`${id}-${size}`} className="w-24">
              {size}
            </FieldLabel>
            <Select
              id={`${id}-${size}`}
              size={size}
              options={FRUITS}
              value={fruit}
              onChange={setFruit}
            />
          </div>
        );
      })}
    </div>
  );
}
```

`disabled` dims the field and takes it out of the tab order. `readOnly`
keeps the tab stop and the value at full contrast, drops the chevron, and
refuses to open.

**Disabled and read only**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, Select, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

export function DisabledAndReadOnly() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>('apple');
  return (
    <div className="flex w-256 flex-col gap-12">
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-disabled`}>Disabled</FieldLabel>
        <Select id={`${id}-disabled`} disabled options={FRUITS} value={fruit} onChange={setFruit} />
      </div>
      <div className="flex flex-col gap-6">
        <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
        <Select
          id={`${id}-read-only`}
          readOnly
          options={FRUITS}
          value={fruit}
          onChange={setFruit}
        />
      </div>
    </div>
  );
}
```

There is no `invalid` prop: `tone="danger"` colours the field and sets
`aria-invalid`. Here it holds until a fruit is picked.
[Tones](../../../../../docs/foundations/tones.md) has what a tone does to a field.

**Danger**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, Select, type Option } from '@bh/ui';

const FRUITS: Option[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

export function Danger() {
  const id = useId();
  const [fruit, setFruit] = useState<string | null>(null);
  return (
    <div className="flex w-256 flex-col gap-6">
      <FieldLabel htmlFor={id} required>
        Fruit
      </FieldLabel>
      <Select
        id={id}
        tone={fruit === null ? 'danger' : undefined}
        options={FRUITS}
        value={fruit}
        onChange={setFruit}
        placeholder="Choose a fruit"
      />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                      | Does                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `Enter` or `Space`       | On the field, opens the list. In the list, picks the option under the cursor and closes it. |
| `ArrowDown` or `ArrowUp` | Moves the cursor to the next or previous option, stepping over disabled ones.               |
| `Home` or `End`          | Moves the cursor to the first or last option that can be picked.                            |
| `Escape`                 | Closes the list.                                                                            |

The list opens with the cursor on the chosen option, so Enter straight
away keeps the value.

The field is a `button` with `role="combobox"`, and `aria-expanded` says
whether the list is open. The list is a `listbox` of `option`s:
`aria-selected` marks the chosen one, and `aria-activedescendant` points
at the one under the cursor. Name the field with a `<label htmlFor>` and
`id`, or with `aria-label` where no visible label points at it, such as a
filter under a column header.

`readOnly` sets `aria-disabled` rather than `aria-readonly`, which ARIA
does not allow on a button.

## When not to use it

- To search a long list as you type, use [Combobox](../combobox/combobox.md).
- To show a few short options at once, use
  [SegmentedControl](../segmented-control/segmented-control.md) or
  [RadioGroup](../radio-group/radio-group.md).
- For several values, use [MultiCombobox](../multi-combobox/multi-combobox.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options` (required)  | `Option[]`                                                                                                                                                                                                  |             | The choices, in the order the list shows them.                                                                                                                                                                  |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Choose…'` | Shown on the field while `value` is `null`.                                                                                                                                                                     |
| `aria-label`          | `string`                                                                                                                                                                                                    |             | The accessible name, for a control with no visible label to point at it — a filter under a column header, where the header is the only caption. A control that has a `<label htmlFor>` should use that instead. |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                             |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws.                                   |
| `value` (required)    | `string \| null`                                                                                                                                                                                            |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                                                      |
| `onChange` (required) | `(value: string \| null, event?: SyntheticEvent) => void`                                                                                                                                                   |             | The new value — and, second, the event that produced it where one exists.                                                                                                                                       |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                           |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |             | The role or scale it is coloured from.                                                                                                                                                                          |
| `disabled`            | `boolean`                                                                                                                                                                                                   |             | Not applicable: removed from the tab order and from form submission.                                                                                                                                            |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |             | Not editable, but still focusable and still submitted.                                                                                                                                                          |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                                                             |
