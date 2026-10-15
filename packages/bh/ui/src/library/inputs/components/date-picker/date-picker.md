---
title: DatePicker
summary: Picks one day, from a calendar or typed, and holds it as an ISO string.
related: [DateRangePicker, TimePicker, FieldLabel]
---

[//]: # 'written from date-picker.doc.yaml by pnpm docs:sync; edit that file, not this one'

# DatePicker

Picks one day, from a calendar or typed as `YYYY-MM-DD`.

`value` is an ISO string, never a `Date`, or `null` when empty. A pick
comes back as UTC midnight, `2026-07-09T00:00:00Z`, and only the first ten
characters are read, so no time zone can move the day.

## Import

```tsx
import { DatePicker } from '@bh/ui';
```

## Examples

A label, here [FieldLabel](../../../forms/components/field-label/field-label.md), names the
field through `id`, which lands on the trigger button. The calendar opens
on the value's month. Under it, a text field takes a typed date, and the
footer picks today, picks the next Friday, or clears the value.

**With a label**

```tsx
import { useId, useState } from 'react';
import { DatePicker, FieldLabel } from '@bh/ui';

export function WithALabel() {
  const id = useId();
  const [due, setDue] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="flex w-208 flex-col gap-4">
      <FieldLabel htmlFor={id}>Due date</FieldLabel>
      <DatePicker id={id} value={due} onChange={setDue} />
    </div>
  );
}
```

`min` and `max` bound the days that can be picked, clicked or typed, as
ISO `yyyy-mm-dd`. Days outside them are still drawn, but disabled. A value
already outside is still shown: the bounds govern what can be picked, not
what can be held.

**Min and max**

```tsx
import { useId, useState } from 'react';
import { DatePicker, FieldLabel } from '@bh/ui';

export function MinAndMax() {
  const id = useId();
  const [delivery, setDelivery] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="flex w-208 flex-col gap-4">
      <FieldLabel htmlFor={id}>Delivery date</FieldLabel>
      <DatePicker
        id={id}
        min="2026-07-06"
        max="2026-07-17"
        value={delivery}
        onChange={setDelivery}
      />
    </div>
  );
}
```

Where no label can point at it, as in a filter under a column header,
name it with `aria-label`. An empty field shows `placeholder`, and its
calendar opens on the current month.

**Without a visible label**

```tsx
import { useState } from 'react';
import { DatePicker } from '@bh/ui';

export function WithoutAVisibleLabel() {
  const [before, setBefore] = useState<string | null>(null);
  return (
    <div className="w-208">
      <DatePicker
        aria-label="Created before"
        placeholder="Any day"
        value={before}
        onChange={setBefore}
      />
    </div>
  );
}
```

`size` steps the height, padding and type together: 30, 38 and 46 pixels.

**Sizes**

```tsx
import { useId, useState } from 'react';
import { DatePicker, FieldLabel } from '@bh/ui';

const SIZES = ['xs', 'md', 'lg'] as const;

export function Sizes() {
  const id = useId();
  const [day, setDay] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="flex w-208 flex-col gap-12">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex flex-col gap-4">
            <FieldLabel htmlFor={`${id}-${size}`}>{size}</FieldLabel>
            <DatePicker id={`${id}-${size}`} size={size} value={day} onChange={setDay} />
          </div>
        );
      })}
    </div>
  );
}
```

Left without a `tone`, the field rests in gray. A tone colours the field
and the calendar's selected day, and a form gives `danger` to a field
whose value is wrong. [Tones](../../../../../docs/foundations/tones.md) has the rest.

**Invalid**

```tsx
import { useId, useState } from 'react';
import { DatePicker, FieldError, FieldLabel } from '@bh/ui';

export function Invalid() {
  const id = useId();
  const [start, setStart] = useState<string | null>('2026-07-14T00:00:00Z');
  const [end, setEnd] = useState<string | null>('2026-07-09T00:00:00Z');
  return (
    <div className="flex w-208 flex-col gap-12">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-start`}>Start</FieldLabel>
        <DatePicker id={`${id}-start`} value={start} onChange={setStart} />
      </div>
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-end`}>End</FieldLabel>
        <DatePicker id={`${id}-end`} tone="danger" value={end} onChange={setEnd} />
        <FieldError>Pick a day after the start.</FieldError>
      </div>
    </div>
  );
}
```

`disabled` takes the field out of the tab order. `readOnly` keeps its tab
stop and its value, drops the chevron, and does not open the calendar.

**Disabled and read only**

```tsx
import { useId, useState } from 'react';
import { DatePicker, FieldLabel } from '@bh/ui';

export function DisabledAndReadOnly() {
  const id = useId();
  const [opened, setOpened] = useState<string | null>('2026-07-01T00:00:00Z');
  const [closed, setClosed] = useState<string | null>('2026-07-31T00:00:00Z');
  return (
    <div className="flex w-208 flex-col gap-12">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-opened`}>Opened</FieldLabel>
        <DatePicker id={`${id}-opened`} disabled value={opened} onChange={setOpened} />
      </div>
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={`${id}-closed`}>Closed</FieldLabel>
        <DatePicker id={`${id}-closed`} readOnly value={closed} onChange={setClosed} />
      </div>
    </div>
  );
}
```

## Keyboard and accessibility

| Key                    | Does                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `Enter` or `Space`     | On the field, opens the calendar. On a day, picks it.                                 |
| `←` or `→`             | Moves to the day before or after, turning the month at its edges.                     |
| `↑` or `↓`             | Moves a week back or forward.                                                         |
| `PageUp` or `PageDown` | Moves a month back or forward, keeping the day, or the month's last if it is shorter. |
| `Home` or `End`        | Moves to the first or the last day of the month.                                      |
| `Esc`                  | Closes the calendar.                                                                  |

The trigger is a `button`, so a `<label for>` names it through `id`, and
`aria-label` names it where nothing else does. The calendar opens in a
popover with `role="dialog"`.

The days are a `grid` with one tab stop: only the day under the keyboard
cursor is tabbable, and moving the cursor picks nothing until Enter. The
picked day has `aria-selected`. The text field under the grid is named
"Enter date", and Enter in it picks the typed date if it is within `min`
and `max`.

A read-only trigger sets `aria-disabled`, since ARIA allows no
`aria-readonly` on a button, and stays in the tab order.

## When not to use it

- For a span of days or months, use
  [DateRangePicker](../date-range-picker/date-range-picker.md).
- For a time of day, use [TimePicker](../time-picker/time-picker.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default       | Description                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Set date…'` | Shown in the field while it is empty.                                                                                                                                                                           |
| `prefix`              | `string`                                                                                                                                                                                                    |               | Words before the value on the field, in the muted tone, as a filter bar names a field inside its control: "Type:" in "Type: any". With one, the placeholder reads as a value would.                             |
| `min`                 | `string`                                                                                                                                                                                                    |               | The earliest day that can be picked, as ISO `yyyy-mm-dd`.                                                                                                                                                       |
| `max`                 | `string`                                                                                                                                                                                                    |               | The latest day that can be picked, as ISO `yyyy-mm-dd`, read as `min` is.                                                                                                                                       |
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
