---
title: DurationInput
summary: A length of time, typed as text and held in minutes.
related: [TimePicker, NumberInput, formatDuration]
---

[//]: # 'written from duration-input.doc.yaml by pnpm docs:sync; edit that file, not this one'

# DurationInput

A length of time, typed as text and held in minutes.

`2h30`, `2h 30m`, `2.5h` and `150m` all read as 150, and a bare number is
minutes. It is a length, not a clock time: `2h30` is two and a half hours,
never half past two.

## Import

```tsx
import { DurationInput } from '@bh/ui';
```

## Examples

The text is read when you leave the field or press Enter, and written back
one way: `2.5h` becomes `2h 30m`. While you type, a line under
the field says what the text will become. An empty field sends `null`; a
stored zero shows as `0m`. Text it cannot read stays in the field to be
corrected, with a message under it, and `onChange` is not called.

**In minutes**

```tsx
import { useId, useState } from 'react';
import { DurationInput, FieldLabel } from '@bh/ui';

export function InMinutes() {
  const id = useId();
  const [minutes, setMinutes] = useState<number | null>(null);
  return (
    <div className="flex w-224 flex-col gap-4">
      <FieldLabel htmlFor={id}>Estimate</FieldLabel>
      <DurationInput id={id} value={minutes} onChange={setMinutes} />
      <p className="text-12 text-gray-11 font-mono">value: {String(minutes)}</p>
    </div>
  );
}
```

Given `budgetMinutes`, a value past it says by how much. The field keeps
its tone: going over is stated, not marked as an error.

**Over budget**

```tsx
import { useId, useState } from 'react';
import { DurationInput, FieldLabel } from '@bh/ui';

export function OverBudget() {
  const id = useId();
  const [minutes, setMinutes] = useState<number | null>(270);
  return (
    <div className="flex w-224 flex-col gap-4">
      <FieldLabel htmlFor={id}>Time spent</FieldLabel>
      <DurationInput id={id} value={minutes} onChange={setMinutes} budgetMinutes={210} />
    </div>
  );
}
```

`readOnly` keeps the field focusable and submitted with a form, and swaps
its fill for a line under the value. `disabled` takes it out of the tab
order and the submission, and fades it.

**Read only and disabled**

```tsx
import { useId, useState } from 'react';
import { DurationInput, FieldLabel } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const id = useId();
  const [minutes, setMinutes] = useState<number | null>(150);
  return (
    <div className="flex w-224 flex-col gap-4">
      <FieldLabel htmlFor={`${id}-read-only`}>Read-only</FieldLabel>
      <DurationInput id={`${id}-read-only`} value={minutes} onChange={setMinutes} readOnly />
      <FieldLabel htmlFor={`${id}-disabled`} className="mt-8">
        Disabled
      </FieldLabel>
      <DurationInput id={`${id}-disabled`} value={minutes} onChange={setMinutes} disabled />
    </div>
  );
}
```

## Keyboard and accessibility

| Key     | Does                                                           |
| ------- | -------------------------------------------------------------- |
| `Enter` | Reads the text and sends the value, as leaving the field does. |

Name it with a `<label htmlFor>` pointing at its `id`. Where no label
can point at it, as under a column header, give it `aria-label`.

Text it cannot read sets `aria-invalid`, as `tone="danger"` does, and its
message is a `role="alert"` paragraph. The line that says what the text
will become, and the one that says how far over budget, are plain text.

## When not to use it

- For a time of day, use [TimePicker](../time-picker/time-picker.md).
- For a count that is not a length of time, use
  [NumberInput](../number-input/number-input.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default    | Description                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'2h 30m'` | Shown while the field is empty.                                                                                                                                                                                        |
| `budgetMinutes`       | `number`                                                                                                                                                                                                    |            | A budget to measure against — an estimate, a remaining allowance. When the value exceeds it, the overage is stated rather than the field turning red: going over is a fact about the work, not a mistake in the field. |
| `aria-label`          | `string`                                                                                                                                                                                                    |            | The accessible name, for a control with no visible label to point at it — a filter under a column header, where the header is the only caption. A control that has a `<label htmlFor>` should use that instead.        |
| `id`                  | `string`                                                                                                                                                                                                    |            | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                                    |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |            | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws.                                          |
| `value` (required)    | `number \| null`                                                                                                                                                                                            |            | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                                                             |
| `onChange` (required) | `(value: number \| null, event?: SyntheticEvent) => void`                                                                                                                                                   |            | The new value — and, second, the event that produced it where one exists.                                                                                                                                              |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`     | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                                  |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |            | The role or scale it is coloured from.                                                                                                                                                                                 |
| `disabled`            | `boolean`                                                                                                                                                                                                   |            | Not applicable: removed from the tab order and from form submission.                                                                                                                                                   |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |            | Not editable, but still focusable and still submitted.                                                                                                                                                                 |
| `className`           | `string`                                                                                                                                                                                                    |            | Added to the control's own classes.                                                                                                                                                                                    |

The reader it uses is exported too. The writer is
[`formatDuration`](../../../primitives/components/format-duration/format-duration.md), which
writes a length in minutes as the field does, and one in seconds or
milliseconds too.

```ts
parseDuration(raw: string): number | null
```

Parse a length of time into MINUTES.

`2h30`, `2h 30m`, `2.5h` and `150m` are the same duration and all reach 150.
A bare number is minutes, because that is what somebody typing `45` into a
time-tracking field means.

Returns null for anything it cannot read, which the caller shows as unparsed
rather than silently storing a zero — `0` is a real answer and must not be
what a typo produces.

| Parameter        | Type     | Default | Description        |
| ---------------- | -------- | ------- | ------------------ |
| `raw` (required) | `string` |         | The text as typed. |

Returns `number \| null`.
