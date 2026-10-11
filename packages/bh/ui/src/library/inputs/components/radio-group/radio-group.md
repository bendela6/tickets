---
title: RadioGroup
summary: One choice from a few options, every option visible.
related: [SegmentedControl, Select, CheckboxGroup]
---

[//]: # 'written from radio-group.doc.yaml by pnpm docs:sync; edit that file, not this one'

# RadioGroup

One choice from a few options, every option visible.

`value` is the chosen option's `value`. A click changes it and never
empties it, so a radio group always holds a choice. `label` is required:
it becomes the `<legend>` of a `<fieldset>`, which nothing outside can
name.

## Import

```tsx
import { RadioGroup } from '@bh/ui';
```

## Examples

Keep the value in state and pass its setter as `onChange`. The radios
share a generated `name`; pass `name` only when a submitted form needs a
particular key.

**Controlled**

```tsx
import { useState } from 'react';
import { RadioGroup } from '@bh/ui';

const DENSITY = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

export function Controlled() {
  const [value, setValue] = useState('comfortable');
  return <RadioGroup label="Density" options={DENSITY} value={value} onChange={setValue} />;
}
```

`variant="card"` gives each option a bordered box that lights up when
chosen, and the whole box takes the click. `tone` colours that border
and fill as well as the dot.

**Cards**

```tsx
import { useState } from 'react';
import { RadioGroup } from '@bh/ui';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function Cards() {
  const [value, setValue] = useState('system');
  return (
    <RadioGroup variant="card" label="Theme" options={THEMES} value={value} onChange={setValue} />
  );
}
```

`size` sets the circle, 14, 16 or 20 pixels, the type, and the space
between options.

**Sizes**

```tsx
import { useState } from 'react';
import { RadioGroup, type ControlSize } from '@bh/ui';

const DENSITY = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
];

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState('comfortable');
  return (
    <RadioGroup
      label={`Density, ${size}`}
      size={size}
      options={DENSITY}
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

The options sit in a row. Add `flex-wrap` through `className` to let a
long row wrap.

**Many options**

```tsx
import { useState } from 'react';
import { RadioGroup } from '@bh/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
  (day) => ({ value: day.toLowerCase(), label: day }),
);

export function ManyOptions() {
  const [value, setValue] = useState('monday');
  return (
    <RadioGroup
      label="First day of the week"
      className="max-w-360 flex-wrap"
      options={DAYS}
      value={value}
      onChange={setValue}
    />
  );
}
```

From the top: editable, read-only and disabled. An option's own
`disabled` takes out that option alone, and the group's takes out all of
them. `readOnly` keeps the group in the tab order and ignores clicks,
and its labels keep their contrast.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { RadioGroup } from '@bh/ui';

const DENSITY = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
  { value: 'dense', label: 'Dense', disabled: true },
];

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState('compact');
  return (
    <div className="flex flex-col items-start gap-12">
      <RadioGroup label="Editable" options={DENSITY} value={value} onChange={setValue} />
      <RadioGroup label="Read-only" options={DENSITY} value={value} onChange={setValue} readOnly />
      <RadioGroup label="Disabled" options={DENSITY} value={value} onChange={setValue} disabled />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                                                     | Does                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `Tab`                                                   | Moves into the group, onto the chosen option, and on out of it.                     |
| `ArrowDown` or `ArrowRight` or `ArrowUp` or `ArrowLeft` | Moves to the next or previous option and chooses it, unless the group is read-only. |
| `Space`                                                 | Chooses the focused option.                                                         |

The radios are native and share one `name`, so the browser treats them
as one choice with one tab stop. The `<fieldset>` has
`role="radiogroup"` and is named by its legend, which is visually
hidden; `id` goes on it. `readOnly` sets `aria-readonly` on the group.

## When not to use it

- For two to five short options drawn as one control, use
  [SegmentedControl](../segmented-control/segmented-control.md).
- To keep the options out of sight until asked for, use
  [Select](../select/select.md): one choice, behind a field that
  opens.
- For several choices at once, use
  [CheckboxGroup](../checkbox-group/checkbox-group.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label` (required)    | `string`                                                                                                                                                                                                    |             | The group's name, rendered as its `<legend>`, which only screen readers read.                                                                                                 |
| `options` (required)  | `Option[]`                                                                                                                                                                                                  |             | The choices, a radio each, in the order given; a `disabled` option can't be chosen.                                                                                           |
| `variant`             | `RadioGroupVariant`: `'plain'`, `'card'`                                                                                                                                                                    | `'plain'`   | How the options are drawn: `plain`, a mark and a label each, or `card`, each a bordered hit area that lights up when chosen.                                                  |
| `name`                | `string`                                                                                                                                                                                                    |             | The radios' `name`, generated when left out; pass one for a submitted form whose server expects a particular key.                                                             |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `string`                                                                                                                                                                                                    |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                    |
| `onChange` (required) | `(value: string, event?: SyntheticEvent) => void`                                                                                                                                                           |             | The new value — and, second, the event that produced it where one exists.                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   |             | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |             | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                           |
