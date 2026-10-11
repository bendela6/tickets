---
title: Switch
summary: Turns one setting on or off, and can show that a save is in flight.
related: [Checkbox, CheckboxGroup]
---

[//]: # 'written from switch.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Switch

Turns one setting on or off.

It holds a boolean the way [Checkbox](../checkbox/checkbox.md) does:
`value` in, the next boolean out of `onChange`. `pending` shows a save in
flight without taking the switch away from whoever just pressed it.

## Import

```tsx
import { Switch } from '@bh/ui';
```

## Examples

Keep the value in state and pass its setter as `onChange`.

**Controlled**

```tsx
import { useState } from 'react';
import { Switch } from '@bh/ui';

export function Controlled() {
  const [value, setValue] = useState(true);
  return <Switch label="Email alerts" value={value} onChange={setValue} />;
}
```

While `pending`, the knob carries a spinner and the switch keeps the
value just chosen, and stays focusable. If the save fails, set the value
back.

**Pending**

```tsx
import { useState } from 'react';
import { Switch } from '@bh/ui';

export function Pending() {
  const [value, setValue] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <Switch
      label="Back up photos"
      value={value}
      pending={pending}
      onChange={(next) => {
        setValue(next);
        setPending(true);
        // Stands in for the save; on a real failure, set the value back.
        setTimeout(() => setPending(false), 1500);
      }}
    />
  );
}
```

`size` sets the track: 28 by 16, 32 by 18 or 40 by 22 pixels.

**Sizes**

```tsx
import { useState } from 'react';
import { Switch, type ControlSize } from '@bh/ui';

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState(true);
  return <Switch label={size} size={size} value={value} onChange={setValue} />;
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

`tone` colours the track when it is on, and the focus ring; it is
`primary` unless set. [Tones](../../../../../docs/foundations/tones.md) has the names.

**Tones**

```tsx
import { useState } from 'react';
import { Switch, type Tone } from '@bh/ui';

function Toned({ tone }: { tone: Tone }) {
  const [value, setValue] = useState(true);
  return <Switch label={tone} tone={tone} value={value} onChange={setValue} />;
}

export function Tones() {
  return (
    <div className="flex flex-col gap-8">
      <Toned tone="primary" />
      <Toned tone="secondary" />
      <Toned tone="success" />
      <Toned tone="warning" />
      <Toned tone="danger" />
      <Toned tone="neutral" />
    </div>
  );
}
```

`readOnly` keeps the switch in the tab order and in its colour, and
ignores clicks; `disabled` takes it out of the tab order and fades it.
All three here show one value, and only the first can change it.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { Switch } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState(true);
  return (
    <div className="flex flex-col gap-12">
      <Switch label="Editable" value={value} onChange={setValue} />
      <Switch label="Read-only" value={value} onChange={setValue} readOnly />
      <Switch label="Disabled" value={value} onChange={setValue} disabled />
    </div>
  );
}
```

Leave `label` out when something else names the switch: point a
`<label htmlFor>` at its `id`, or give it an `aria-label`.

**Named from outside**

```tsx
import { useState } from 'react';
import { Switch } from '@bh/ui';

export function NamedFromOutside() {
  const [value, setValue] = useState(false);
  return (
    <div className="flex w-256 items-center justify-between">
      <label htmlFor="dark-mode" className="text-13">
        Dark mode
      </label>
      <Switch id="dark-mode" value={value} onChange={setValue} />
    </div>
  );
}
```

## Keyboard and accessibility

| Key     | Does                                                |
| ------- | --------------------------------------------------- |
| `Space` | Turns the switch on or off, unless it is read-only. |

It is a native checkbox with `role="switch"`, so a screen reader
announces a switch, on or off. `id`, and any other attribute it doesn't
take itself, go on that input. `pending` sets `aria-busy` and leaves the
switch enabled. `readOnly` sets `aria-readonly`; the platform's
`readonly` does nothing on a checkbox.

## When not to use it

For a mixed state, use [Checkbox](../checkbox/checkbox.md): it has
`indeterminate`, and a switch has not.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`               | `string`                                                                                                                                                                                                    |             | The text beside the track; leave it out when `aria-label` or a `<label htmlFor>` names the switch instead.                                                                                                                                    |
| `pending`             | `boolean`                                                                                                                                                                                                   |             | A save is in flight: the knob carries a spinner, and the switch keeps the value just chosen and its tab stop.                                                                                                                                 |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | Identifies the element (or elements) that describes the object. The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `boolean`                                                                                                                                                                                                   |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                                                                                    |
| `onChange` (required) | `(value: boolean, event?: SyntheticEvent) => void`                                                                                                                                                          |             | The new value — and, second, the event that produced it where one exists.                                                                                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | The role or scale it is coloured from.                                                                                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   |             | Not applicable: removed from the tab order and from form submission.                                                                                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |             | Not editable, but still focusable and still submitted.                                                                                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                                                                                           |
| `ref`                 | `Ref<HTMLInputElement>`                                                                                                                                                                                     |             | Forwarded to the `<input>`.                                                                                                                                                                                                                   |

Also every `<input>` attribute (`InputHTMLAttributes<HTMLInputElement>`), passed through.
