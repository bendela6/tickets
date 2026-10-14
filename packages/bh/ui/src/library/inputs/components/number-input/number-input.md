---
title: NumberInput
summary: A number, typed or stepped; an empty field is null, not zero.
related: [DurationInput, Slider, Input]
---

[//]: # 'written from number-input.doc.yaml by pnpm docs:sync; edit that file, not this one'

# NumberInput

A number, typed or stepped.

`value` is `number | null`: an empty field is `null`, not zero, because
nothing given yet and zero are different answers. Clearing the field sends
`null`, and a step from empty starts from zero.

## Import

```tsx
import { NumberInput } from '@bh/ui';
```

## Examples

The steppers stop at `min` and `max`, and at a bound that way's step is
dimmed, not removed, so the other does not shift under the pointer. Typing
is not held to them.

**Min and max**

```tsx
import { useState } from 'react';
import { NumberInput } from '@bh/ui';

export function MinAndMax() {
  const [guests, setGuests] = useState<number | null>(1);
  return (
    <div className="w-160">
      <NumberInput aria-label="Guests" value={guests} onChange={setGuests} min={1} max={8} />
    </div>
  );
}
```

`step` is how far one press moves the value.

**Half steps**

```tsx
import { useState } from 'react';
import { NumberInput } from '@bh/ui';

export function HalfSteps() {
  const [hours, setHours] = useState<number | null>(1.5);
  return (
    <div className="w-160">
      <NumberInput
        aria-label="Hours"
        value={hours}
        onChange={setHours}
        min={0}
        max={12}
        step={0.5}
      />
    </div>
  );
}
```

Clear the field and `onChange` sends `null`.

**Empty is null**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, NumberInput } from '@bh/ui';

export function EmptyIsNull() {
  const id = useId();
  const [width, setWidth] = useState<number | null>(null);
  return (
    <div className="flex w-160 flex-col gap-4">
      <FieldLabel htmlFor={id}>Width</FieldLabel>
      <NumberInput id={id} value={width} onChange={setWidth} placeholder="Any" />
      <p className="text-12 text-gray-11 font-mono">value: {String(width)}</p>
    </div>
  );
}
```

`size` sets the height, padding, radius and type together: 30, 38 and 46
pixels.

**Sizes**

```tsx
import { useState } from 'react';
import { NumberInput } from '@bh/ui';

export function Sizes() {
  const [count, setCount] = useState<number | null>(3);
  return (
    <div className="flex w-160 flex-col gap-8">
      <NumberInput size="xs" aria-label="Count, extra small" value={count} onChange={setCount} />
      <NumberInput size="md" aria-label="Count, medium" value={count} onChange={setCount} />
      <NumberInput size="lg" aria-label="Count, large" value={count} onChange={setCount} />
    </div>
  );
}
```

`readOnly` removes the steppers, keeps the field focusable and submitted
with a form, and swaps its fill for a line under the value. `disabled`
keeps the steppers, fades them with the field, and takes it out of the
tab order and the submission.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { NumberInput } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [count, setCount] = useState<number | null>(3);
  return (
    <div className="flex w-160 flex-col gap-8">
      <NumberInput aria-label="Count, read-only" value={count} onChange={setCount} readOnly />
      <NumberInput aria-label="Count, disabled" value={count} onChange={setCount} disabled />
    </div>
  );
}
```

`commit` says when `onChange` gets the number, as on
[Input](../input/input.md#when-it-commits). Leaving the whole
control commits: moving between the field and its steppers is still
editing, so a run of clicks commits once. A click on a stepper puts the
caret in the field.

**An estimate saved on leaving**

```tsx
import { useState } from 'react';
import { NumberInput } from '@bh/ui';

export function AnEstimateSavedOnLeaving() {
  const [hours, setHours] = useState<number | null>(3);
  const [draft, setDraft] = useState<number | null>(hours);
  const [saves, setSaves] = useState(0);
  return (
    <div className="flex w-256 flex-col gap-6">
      <NumberInput
        aria-label="Estimate, in hours"
        value={hours}
        min={0}
        commit="leave"
        onDraft={setDraft}
        onChange={(next) => {
          setHours(next);
          setSaves((count) => count + 1);
        }}
      />
      <p className="text-12/17 text-gray-11 font-sans">
        Draft <span className="text-gray-12 font-mono">{draft ?? 'empty'}</span>, saved{' '}
        <span className="text-gray-12 font-mono">{hours ?? 'empty'}</span>, {saves}{' '}
        {saves === 1 ? 'save' : 'saves'}
      </p>
    </div>
  );
}
```

## Keyboard and accessibility

| Key                      | Does                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ArrowUp` or `ArrowDown` | Steps the value by `step`, as the browser's number field does.                                                                                     |
| `Tab`                    | Moves on to the next field. The steppers are not tab stops.                                                                                        |
| `Enter`                  | Commits the draft, when the field holds one.                                                                                                       |
| `Escape`                 | Drops the draft, when the field holds one, and puts the value back. In a dialog or a drawer the same press closes it, and the draft never commits. |

The field is an `<input type="number">` with the role `spinbutton`, and
the ref lands on it. The steppers are buttons named "Increment" and
"Decrement".

It passes no other attributes through: name it with `aria-label`, or with
a `<label htmlFor>` pointing at its `id`.

## When not to use it

- For a length of time, use [DurationInput](../duration-input/duration-input.md),
  which reads `2h 30m`.
- To pick a value in a range by dragging, use
  [Slider](../slider/slider.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default    | Description                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `min`                 | `number`                                                                                                                                                                                                    |            | The lowest value the steppers go to. At it, the down step is dimmed.                                                                                                                                            |
| `max`                 | `number`                                                                                                                                                                                                    |            | The highest value the steppers go to. At it, the up step is dimmed.                                                                                                                                             |
| `step`                | `number`                                                                                                                                                                                                    | `1`        | How far one press of a stepper moves the value.                                                                                                                                                                 |
| `placeholder`         | `string`                                                                                                                                                                                                    |            | Shown while the field is empty.                                                                                                                                                                                 |
| `aria-label`          | `string`                                                                                                                                                                                                    |            | The accessible name, for a control with no visible label to point at it — a filter under a column header, where the header is the only caption. A control that has a `<label htmlFor>` should use that instead. |
| `id`                  | `string`                                                                                                                                                                                                    |            | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                             |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |            | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws.                                   |
| `value` (required)    | `number \| null`                                                                                                                                                                                            |            | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                                                      |
| `onChange` (required) | `(value: number \| null, event?: SyntheticEvent) => void`                                                                                                                                                   |            | The new value — and, second, the event that produced it where one exists.                                                                                                                                       |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`     | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                           |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |            | The role or scale it is coloured from.                                                                                                                                                                          |
| `disabled`            | `boolean`                                                                                                                                                                                                   |            | Not applicable: removed from the tab order and from form submission.                                                                                                                                            |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |            | Not editable, but still focusable and still submitted.                                                                                                                                                          |
| `className`           | `string`                                                                                                                                                                                                    |            | Added to the control's own classes.                                                                                                                                                                             |
| `commit`              | `Commit`                                                                                                                                                                                                    | `'change'` | When `onChange` gets what you typed: `'change'` at every keystroke; `'leave'` on Enter and on leaving the field or the window; `{ after: 800 }` on those and after 800 ms without typing.                       |
| `onDraft`             | `(draft: number \| null) => void`                                                                                                                                                                           |            | What's in the field, at every keystroke, before it commits: for a count, a preview, or a button that waits for some text. At `'change'` it's what `onChange` gets.                                              |
| `ref`                 | `Ref<HTMLInputElement>`                                                                                                                                                                                     |            | Forwarded to the `<input>`.                                                                                                                                                                                     |
