---
title: TimePicker
summary: Picks a time of day from a list, or typed, and holds it as HH:MM.
related: [DatePicker, DurationInput, Combobox]
---

[//]: # 'written from time-picker.doc.yaml by pnpm docs:sync; edit that file, not this one'

# TimePicker

Picks a time of day from a list, or typed.

`value` is `HH:MM` on a 24-hour clock, or `null` when empty. The list
offers a time every `stepMinutes`, 15 by default, and the field above it
takes any time typed as `H:MM` or `HH:MM`.

## Import

```tsx
import { TimePicker } from '@bh/ui';
```

## Examples

A label names the field through `id`, which lands on the trigger button.
The list opens scrolled to the value.

**With a label**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, TimePicker } from '@bh/ui';

export function WithALabel() {
  const id = useId();
  const [start, setStart] = useState<string | null>('14:30');
  return (
    <div className="flex w-192 flex-col gap-4">
      <FieldLabel htmlFor={id}>Start time</FieldLabel>
      <TimePicker id={id} value={start} onChange={setStart} />
    </div>
  );
}
```

`stepMinutes` sets the gap between listed times. A time not on the list
can still be typed, and Enter commits it; one that is not a time of day,
like `25:99`, is refused with a message.

**Five minute steps**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, TimePicker } from '@bh/ui';

export function FiveMinuteSteps() {
  const id = useId();
  const [alarm, setAlarm] = useState<string | null>('09:05');
  return (
    <div className="flex w-192 flex-col gap-4">
      <FieldLabel htmlFor={id}>Alarm</FieldLabel>
      <TimePicker id={id} stepMinutes={5} value={alarm} onChange={setAlarm} />
    </div>
  );
}
```

`size` steps the height, padding and type together: 30, 38 and 46 pixels.

**Sizes**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, TimePicker } from '@bh/ui';

const SIZES = ['xs', 'md', 'lg'] as const;

export function Sizes() {
  const id = useId();
  const [time, setTime] = useState<string | null>('14:30');
  return (
    <div className="flex w-192 flex-col gap-12">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex flex-col gap-4">
            <FieldLabel htmlFor={`${id}-${size}`}>{size}</FieldLabel>
            <TimePicker id={`${id}-${size}`} size={size} value={time} onChange={setTime} />
          </div>
        );
      })}
    </div>
  );
}
```

`disabled` takes the field out of the tab order. `readOnly` keeps its tab
stop and its value, drops the chevron, and does not open the list.

**Disabled and read only**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, TimePicker } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [opens, setOpens] = useState<string | null>('09:00');
  const [closes, setCloses] = useState<string | null>('17:30');
  return (
    <div className="flex w-192 flex-col gap-12">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-opens`}>Opens</FieldLabel>
        <TimePicker id={`${id}-opens`} disabled value={opens} onChange={setOpens} />
      </div>
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-closes`}>Closes</FieldLabel>
        <TimePicker id={`${id}-closes`} readOnly value={closes} onChange={setCloses} />
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

| Key                      | Does                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Enter` or `Space`       | On the field, opens the list with focus in the time field. On a listed time, picks it.                                                                      |
| `ArrowDown` or `ArrowUp` | In the time field, moves the cursor to the next or previous listed time and writes it into the field. From an empty field, starts at the first or the last. |
| `Home` or `End`          | In the time field, moves the cursor to the first or the last listed time.                                                                                   |
| `Enter`                  | In the time field, commits the time it shows, typed or under the cursor, if it is a time of day.                                                            |
| `Tab`                    | Moves from the time field through the listed times.                                                                                                         |
| `Esc`                    | Closes the list.                                                                                                                                            |

The list opens with the cursor on the chosen time, so Enter straight away
keeps the value. The cursor is the listed time the field holds: typing a
listed time moves it there, and a time typed between two rows has none
until an arrow steps to a neighbour.

The trigger is a `button` with `role="combobox"`, `aria-haspopup="listbox"`
and `aria-expanded`. Name it with a `<label for>` pointing at `id`, or,
where no label can point at it, with `aria-label`. `tone="danger"` sets
`aria-invalid`.

The times are a `listbox` named by `label`, "Times" by default, and each
is an `option`; the picked one has `aria-selected`. The time field is
named "Enter a time". It keeps focus while the cursor moves, points at the
list with `aria-controls` and at the time under the cursor with
`aria-activedescendant`, and its message for an entry that is not a time
has `role="alert"`.

A read-only trigger sets `aria-disabled`, since ARIA allows no
`aria-readonly` on a button, and stays in the tab order.

## When not to use it

- For a length of time rather than a time of day, use
  [DurationInput](../duration-input/duration-input.md).
- For a day, use [DatePicker](../date-picker/date-picker.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default       | Description                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stepMinutes`         | `number`                                                                                                                                                                                                    | `15`          | Minutes between offered times. 15 unless the schedule is finer.                                                                                                                                                 |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Set time…'` | Shown in the field while it is empty.                                                                                                                                                                           |
| `label`               | `string`                                                                                                                                                                                                    | `'Times'`     | Names the list of times for a screen reader; it does not name the field.                                                                                                                                        |
| `aria-label`          | `string`                                                                                                                                                                                                    |               | The accessible name, for a control with no visible label to point at it — a filter under a column header, where the header is the only caption. A control that has a `<label htmlFor>` should use that instead. |
| `id`                  | `string`                                                                                                                                                                                                    |               | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                             |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |               | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws.                                   |
| `value` (required)    | `string \| null`                                                                                                                                                                                            |               | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                                                      |
| `onChange` (required) | `(value: string \| null, event?: SyntheticEvent) => void`                                                                                                                                                   |               | The new value — and, second, the event that produced it where one exists.                                                                                                                                       |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`        | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                           |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |               | The role or scale it is coloured from.                                                                                                                                                                          |
| `disabled`            | `boolean`                                                                                                                                                                                                   |               | Not applicable: removed from the tab order and from form submission.                                                                                                                                            |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |               | Not editable, but still focusable and still submitted.                                                                                                                                                          |
| `className`           | `string`                                                                                                                                                                                                    |               | Added to the control's own classes.                                                                                                                                                                             |
