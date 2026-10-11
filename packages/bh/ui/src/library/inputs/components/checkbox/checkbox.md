---
title: Checkbox
summary: One yes-or-no choice, with an optional label beside the box.
related: [CheckboxGroup, Switch, RadioGroup]
---

[//]: # 'written from checkbox.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Checkbox

One yes-or-no choice, with an optional label beside the box.

It holds no value of its own: `value` is the boolean it shows, and
`onChange` hands back the next one, with the change event second.
`indeterminate` is a dash drawn over the value, not a third value.

## Import

```tsx
import { Checkbox } from '@bh/ui';
```

## Examples

Keep the value in state and pass its setter as `onChange`.

**Controlled**

```tsx
import { useState } from 'react';
import { Checkbox } from '@bh/ui';

export function Controlled() {
  const [value, setValue] = useState(false);
  return <Checkbox label="Email me a copy" value={value} onChange={setValue} />;
}
```

`indeterminate` draws a dash, for a box that stands for several others
when only some of them are on.
[CheckboxGroup](../checkbox-group/checkbox-group.md) draws one for you with
`selectAllLabel`.

**Indeterminate**

```tsx
import { useState } from 'react';
import { Checkbox } from '@bh/ui';

const FRUITS = ['Apple', 'Banana', 'Cherry'];

export function Indeterminate() {
  const [chosen, setChosen] = useState(['Apple']);
  const all = chosen.length === FRUITS.length;
  return (
    <div className="flex flex-col gap-8">
      <Checkbox
        label="All fruits"
        value={all}
        indeterminate={chosen.length > 0 && !all}
        onChange={(next) => setChosen(next ? FRUITS : [])}
      />
      {FRUITS.map((fruit) => {
        return (
          <Checkbox
            key={fruit}
            label={fruit}
            className="ml-24"
            value={chosen.includes(fruit)}
            onChange={(next) => {
              setChosen(next ? [...chosen, fruit] : chosen.filter((item) => item !== fruit));
            }}
          />
        );
      })}
    </div>
  );
}
```

`size` sets the box, 14, 16 or 20 pixels, and the label's type size
together.

**Sizes**

```tsx
import { useState } from 'react';
import { Checkbox, type ControlSize } from '@bh/ui';

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState(true);
  return <Checkbox label={size} size={size} value={value} onChange={setValue} />;
}

export function Sizes() {
  return (
    <div className="flex items-center gap-16">
      <Sized size="xs" />
      <Sized size="md" />
      <Sized size="lg" />
    </div>
  );
}
```

`tone` colours the checked fill and the focus ring, and is `primary`
unless set: [Tones](../../../../../docs/foundations/tones.md) has the names.

**Tones**

```tsx
import { useState } from 'react';
import { Checkbox, type Tone } from '@bh/ui';

function Toned({ tone }: { tone: Tone }) {
  const [value, setValue] = useState(true);
  return <Checkbox label={tone} tone={tone} value={value} onChange={setValue} />;
}

export function Tones() {
  return (
    <div className="flex items-center gap-16">
      <Toned tone="primary" />
      <Toned tone="success" />
      <Toned tone="warning" />
      <Toned tone="danger" />
    </div>
  );
}
```

`readOnly` keeps the box in the tab order and in its colour, and ignores
clicks; `disabled` takes it out of the tab order and fades it. All three
boxes here show one value, and only the first can change it.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { Checkbox } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState(true);
  return (
    <div className="flex flex-col gap-12">
      <Checkbox label="Editable" value={value} onChange={setValue} />
      <Checkbox label="Read-only" value={value} onChange={setValue} readOnly />
      <Checkbox label="Disabled" value={value} onChange={setValue} disabled />
    </div>
  );
}
```

Leave `label` out when something else names the box: give it an
`aria-label`, or point a `<label htmlFor>` at its `id`.

**Without a label**

```tsx
import { useState } from 'react';
import { Checkbox } from '@bh/ui';

export function WithoutALabel() {
  const [value, setValue] = useState(false);
  return (
    <div className="flex items-center gap-8">
      <Checkbox aria-label="Select report.pdf" value={value} onChange={setValue} />
      <span className="text-13 font-mono">report.pdf</span>
    </div>
  );
}
```

## Keyboard and accessibility

| Key     | Does                                     |
| ------- | ---------------------------------------- |
| `Space` | Toggles the box, unless it is read-only. |

It is a native `<input type="checkbox">` inside a `<label>`, so `label`
names it and a click on the text toggles it. `id`, and any other
attribute it doesn't take itself, go on the input. `readOnly` sets
`aria-readonly`; the platform's `readonly` does nothing on a checkbox.
`indeterminate` is set on the input's own `indeterminate` property,
which has no attribute.

## When not to use it

For several choices under one name, use
[CheckboxGroup](../checkbox-group/checkbox-group.md): it draws the boxes,
names the group and holds the chosen values as one array.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`               | `string`                                                                                                                                                                                                    |             | The text beside the box; leave it out when `aria-label` or a `<label htmlFor>` names the box instead.                                                                                                                                         |
| `indeterminate`       | `boolean`                                                                                                                                                                                                   | `false`     | Draws a dash for a mixed state, over whatever `value` holds.                                                                                                                                                                                  |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | Identifies the element (or elements) that describes the object. The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `boolean`                                                                                                                                                                                                   |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                                                                                    |
| `onChange` (required) | `(value: boolean, event?: SyntheticEvent) => void`                                                                                                                                                          |             | The new value — and, second, the event that produced it where one exists.                                                                                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | The role or scale it is coloured from.                                                                                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   |             | Not applicable: removed from the tab order and from form submission.                                                                                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   | `false`     | Not editable, but still focusable and still submitted.                                                                                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                                                                                           |
| `ref`                 | `Ref<HTMLInputElement>`                                                                                                                                                                                     |             | Forwarded to the `<input>`.                                                                                                                                                                                                                   |

Also every `<input>` attribute (`InputHTMLAttributes<HTMLInputElement>`), passed through.
