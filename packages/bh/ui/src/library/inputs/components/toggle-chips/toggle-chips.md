---
title: ToggleChips
summary: A multiple choice among a few short options, each a chip one click
  away, as in a filter bar.
related: [CheckboxGroup, MultiCombobox, SegmentedControl]
---

[//]: # 'written from toggle-chips.doc.yaml by pnpm docs:sync; edit that file, not this one'

# ToggleChips

A multiple choice among a few short options, each a chip one click away,
as in a filter bar.

`value` is the pressed options' values, and pressing a chip adds its value
or takes it out. It holds the same array as
[MultiCombobox](../multi-combobox/multi-combobox.md), with every option in
view.

## Import

```tsx
import { ToggleChips } from '@bh/ui';
```

## Examples

Keep the value in state and pass its setter as `onChange`.

**Controlled**

```tsx
import { useState } from 'react';
import { ToggleChips } from '@bh/ui';

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'grape', label: 'Grape' },
];

export function Controlled() {
  const [value, setValue] = useState<string[]>(['banana']);
  return <ToggleChips label="Fruits" options={FRUITS} value={value} onChange={setValue} />;
}
```

An option's `color` draws a dot before its label and paints the chip
when pressed; without one, a pressed chip paints from `tone`,
`primary` unless given, and so does the `+N` chip.

**Coloured options**

```tsx
import { useState } from 'react';
import { ToggleChips, type Option } from '@bh/ui';

const COLOURS: Option[] = [
  { value: 'red', label: 'Red', color: 'red' },
  { value: 'orange', label: 'Orange', color: 'orange' },
  { value: 'green', label: 'Green', color: 'green' },
  { value: 'blue', label: 'Blue', color: 'blue' },
];

export function ColouredOptions() {
  const [value, setValue] = useState<string[]>(['orange', 'blue']);
  return <ToggleChips label="Colours" options={COLOURS} value={value} onChange={setValue} />;
}
```

Past `maxVisible`, 6 unless set, the rest of the options sit behind a
`+N` chip that opens a searchable list. While some of them are pressed,
the `+N` chip is pressed too and counts them.

**Overflow**

```tsx
import { useState } from 'react';
import { ToggleChips } from '@bh/ui';

const CITIES = ['Lima', 'Oslo', 'Paris', 'Tokyo', 'Cairo', 'Delhi', 'Quito', 'Seoul'].map(
  (city) => {
    return { value: city.toLowerCase(), label: city };
  },
);

export function Overflow() {
  const [value, setValue] = useState<string[]>(['oslo', 'seoul']);
  return (
    <ToggleChips label="Cities" maxVisible={4} options={CITIES} value={value} onChange={setValue} />
  );
}
```

`size` sets the chips' height, 30, 38 or 46 pixels, with their type and
padding.

**Sizes**

```tsx
import { useState } from 'react';
import { ToggleChips, type ControlSize } from '@bh/ui';

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState<string[]>(['banana']);
  return (
    <ToggleChips
      label={`Fruits, ${size}`}
      size={size}
      options={FRUITS}
      value={value}
      onChange={setValue}
    />
  );
}

export function Sizes() {
  return (
    <div className="flex flex-col gap-12">
      <Sized size="xs" />
      <Sized size="md" />
      <Sized size="lg" />
    </div>
  );
}
```

An option's own `disabled` takes out that chip alone, and the group's
takes out all of them. `readOnly` instead keeps the chips in the tab
order and ignores clicks, and its `+N` chip opens nothing.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { ToggleChips } from '@bh/ui';

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'grape', label: 'Grape', disabled: true },
];

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState<string[]>(['banana']);
  return (
    <div className="flex flex-col gap-12">
      <ToggleChips label="Fruits" options={FRUITS} value={value} onChange={setValue} />
      <ToggleChips
        label="Fruits, read-only"
        options={FRUITS}
        value={value}
        onChange={setValue}
        readOnly
      />
      <ToggleChips
        label="Fruits, disabled"
        options={FRUITS}
        value={value}
        onChange={setValue}
        disabled
      />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                      | Does                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| `Tab`                    | Moves from chip to chip.                                                          |
| `Enter` or `Space`       | Presses or releases the focused chip; on the `+N` chip, opens the list.           |
| `ArrowDown` or `ArrowUp` | In the list, moves through the options, past any that are disabled.               |
| `Enter`                  | In the list, presses or releases the highlighted option, and keeps the list open. |
| `Escape`                 | Closes the list.                                                                  |

Each chip is a button with `aria-pressed` in a `group` named by `label`,
so a screen reader hears a toggle button, pressed or not; `id` goes on
the group. The `+N` chip is named from the count and `label`, as "4 more
cities options" above, and the list opens with its search box focused.
`disabled` sets `aria-disabled` on the group and disables every chip.
`readOnly` sets `aria-disabled` on each chip instead, which keeps its tab
stop: ARIA allows no `aria-readonly` on a button.

## When not to use it

- For one choice, use
  [SegmentedControl](../segmented-control/segmented-control.md).
- To keep the options out of sight until asked for, use
  [MultiCombobox](../multi-combobox/multi-combobox.md): the same array,
  behind a field that opens.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options` (required)  | `Option[]`                                                                                                                                                                                                  |             | The chips, in the order given; an option's `color` draws a dot before its label and paints it when pressed, and a `disabled` option can't be pressed.                         |
| `label` (required)    | `string`                                                                                                                                                                                                    |             | The group's accessible name, also used in the `+N` chip's.                                                                                                                    |
| `maxVisible`          | `number`                                                                                                                                                                                                    | `6`         | How many options are laid out as chips; the rest sit behind a `+N` chip that opens a searchable list.                                                                         |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `string[]`                                                                                                                                                                                                  |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                    |
| `onChange` (required) | `(value: string[], event?: SyntheticEvent) => void`                                                                                                                                                         |             | The new value — and, second, the event that produced it where one exists.                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   | `false`     | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   | `false`     | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                           |
