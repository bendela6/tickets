---
title: SegmentedControl
summary: An exclusive choice among two to five short options, shown inline.
related: [RadioGroup, Select, ToggleChips]
---

[//]: # 'written from segmented-control.doc.yaml by pnpm docs:sync; edit that file, not this one'

# SegmentedControl

An exclusive choice among two to five short options, shown inline.

The chosen segment sits on one raised tile, which glides from segment to
segment as the choice changes. Each segment is as wide as its own label.

## Import

```tsx
import { SegmentedControl } from '@bh/ui';
```

## Examples

`value` is the chosen option's `value`, and `label` names the group for
screen readers. A value that matches no option draws no tile.

**Controlled**

```tsx
import { useState } from 'react';
import { SegmentedControl } from '@bh/ui';

const RANGES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

export function Controlled() {
  const [value, setValue] = useState('week');
  return <SegmentedControl label="Range" options={RANGES} value={value} onChange={setValue} />;
}
```

An option's `icon` names a glyph from [Icon](../../../primitives/components/icon/icon.md)'s
registry, drawn before the label at the control's size.

**With icons**

```tsx
import { useState } from 'react';
import { SegmentedControl, type Option } from '@bh/ui';

const THEMES: Option[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
];

export function WithIcons() {
  const [value, setValue] = useState('system');
  return <SegmentedControl label="Theme" options={THEMES} value={value} onChange={setValue} />;
}
```

`size` sets the height, 30, 38 or 46 pixels, with the type, the padding
and the glyph.

**Sizes**

```tsx
import { useState } from 'react';
import { SegmentedControl, type ControlSize } from '@bh/ui';

const RANGES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState('week');
  return (
    <SegmentedControl
      label={`Range, ${size}`}
      size={size}
      options={RANGES}
      value={value}
      onChange={setValue}
    />
  );
}

export function Sizes() {
  return (
    <div className="flex flex-col items-start gap-12">
      <Sized size="xs" />
      <Sized size="md" />
      <Sized size="lg" />
    </div>
  );
}
```

Given a wider box, through `className`, the segments keep their own
widths and share the spare width evenly.

**Filling a row**

```tsx
import { useState } from 'react';
import { SegmentedControl } from '@bh/ui';

const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'modified', label: 'Last modified' },
];

export function FillingARow() {
  const [value, setValue] = useState('name');
  return (
    <SegmentedControl
      label="Sort by"
      className="flex w-full"
      options={SORTS}
      value={value}
      onChange={setValue}
    />
  );
}
```

From the top: editable, read-only and disabled. An option's own
`disabled` takes out that segment alone, and the control's takes out all
of them. `readOnly` keeps every segment in the tab order and ignores
clicks.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { SegmentedControl } from '@bh/ui';

const RANGES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year', disabled: true },
];

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState('week');
  return (
    <div className="flex flex-col items-start gap-12">
      <SegmentedControl label="Editable" options={RANGES} value={value} onChange={setValue} />
      <SegmentedControl
        label="Read-only"
        options={RANGES}
        value={value}
        onChange={setValue}
        readOnly
      />
      <SegmentedControl
        label="Disabled"
        options={RANGES}
        value={value}
        onChange={setValue}
        disabled
      />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                        |
| ------------------ | ----------------------------------------------------------- |
| `Tab`              | Moves from segment to segment.                              |
| `Enter` or `Space` | Picks the focused segment, unless the control is read-only. |

The control is a `radiogroup`, named by `label` and given the `id`, and
each segment a button with `role="radio"` and `aria-checked`. Each
segment is its own tab stop; the arrow keys don't move between them. A
glyph is hidden from screen readers, so a segment is named by its label
alone. `readOnly` sets `aria-readonly`; `disabled` sets `aria-disabled`
and takes the segments out of the tab order.

## When not to use it

- Past about five options the row stops fitting: use
  [Select](../select/select.md).
- For several choices at once, use
  [ToggleChips](../toggle-chips/toggle-chips.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options` (required)  | `Option[]`                                                                                                                                                                                                  |             | The segments, in the order given; an option's `icon` is drawn before its label, and a `disabled` option can't be picked.                                                      |
| `label` (required)    | `string`                                                                                                                                                                                                    |             | The group's accessible name.                                                                                                                                                  |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `string`                                                                                                                                                                                                    |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                    |
| `onChange` (required) | `(value: string, event?: SyntheticEvent) => void`                                                                                                                                                           |             | The new value — and, second, the event that produced it where one exists.                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   | `false`     | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   | `false`     | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                           |
