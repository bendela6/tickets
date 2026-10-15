---
title: DateRangePicker
summary: Picks a span of days, or of months, and holds its two ends as ISO strings.
related: [DatePicker, RangeSlider, TimePicker]
---

[//]: # 'written from date-range-picker.doc.yaml by pnpm docs:sync; edit that file, not this one'

# DateRangePicker

Picks a span of days, or of months, from a calendar.

`value` is `[start, end]`. The first pick sets the start and leaves the end
`null`; the second sets the end and closes the popup. A range picked
backwards comes back in order, and a pick after a whole range starts a new
one.

## Import

```tsx
import { DateRangePicker, type DateRange } from '@bh/ui';
```

## Examples

Each end of a span of days is an ISO instant at UTC midnight,
`2026-08-04T00:00:00Z`. While the end is pending, the span paints up to
the day under the pointer. A label names the field through `id`.

**A span of days**

```tsx
import { useId, useState } from 'react';
import { DateRangePicker, FieldLabel, type DateRange } from '@bh/ui';

export function ASpanOfDays() {
  const id = useId();
  const [dates, setDates] = useState<DateRange>(['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']);
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Dates</FieldLabel>
      <DateRangePicker id={id} value={dates} onChange={setDates} />
    </div>
  );
}
```

With a start and no end, the trigger shows `end` where the end will go,
and the next pick closes the range.

**Half picked**

```tsx
import { useId, useState } from 'react';
import { DateRangePicker, FieldLabel, type DateRange } from '@bh/ui';

export function HalfPicked() {
  const id = useId();
  const [stay, setStay] = useState<DateRange>(['2026-08-04T00:00:00Z', null]);
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Stay</FieldLabel>
      <DateRangePicker id={id} value={stay} onChange={setStay} />
    </div>
  );
}
```

`granularity="month"` picks whole months from a year of them, each end
held as `2023-08`. The arrows move a year, and a range may cross one.

**By month**

```tsx
import { useId, useState } from 'react';
import { DateRangePicker, FieldLabel, type DateRange } from '@bh/ui';

export function ByMonth() {
  const id = useId();
  const [term, setTerm] = useState<DateRange>(['2023-08', '2024-05']);
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Term</FieldLabel>
      <DateRangePicker id={id} granularity="month" value={term} onChange={setTerm} />
    </div>
  );
}
```

`openEnd` names an end that has not come yet. With it, `[start, null]` is
a settled range: the trigger shows the name after the arrow, and the popup
offers it as a button that ends a pick there.

**Open end**

```tsx
import { useId, useState } from 'react';
import { DateRangePicker, FieldLabel, type DateRange } from '@bh/ui';

export function OpenEnd() {
  const id = useId();
  const [lease, setLease] = useState<DateRange>(['2023-08', null]);
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Lease</FieldLabel>
      <DateRangePicker
        id={id}
        granularity="month"
        openEnd="Ongoing"
        value={lease}
        onChange={setLease}
      />
    </div>
  );
}
```

`size` steps the height, padding and type together: 30, 38 and 46 pixels.

**Sizes**

```tsx
import { useId, useState } from 'react';
import { DateRangePicker, FieldLabel, type DateRange } from '@bh/ui';

const SIZES = ['xs', 'md', 'lg'] as const;

export function Sizes() {
  const id = useId();
  const [dates, setDates] = useState<DateRange>(['2026-08-04T00:00:00Z', '2026-08-18T00:00:00Z']);
  return (
    <div className="flex w-256 flex-col gap-12">
      {SIZES.map((size) => {
        return (
          <div key={size} className="flex flex-col gap-4">
            <FieldLabel htmlFor={`${id}-${size}`}>{size}</FieldLabel>
            <DateRangePicker id={`${id}-${size}`} size={size} value={dates} onChange={setDates} />
          </div>
        );
      })}
    </div>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `Enter` or `Space` | On the field, opens the popup. On a day or a month, picks it.                                                       |
| `Tab`              | Moves through the arrows, the days and the footer; while the end is pending, the span paints up to the focused day. |
| `Esc`              | Closes the popup.                                                                                                   |

The trigger is a `button` with `role="combobox"`, `aria-haspopup="dialog"`
and `aria-expanded`. It takes `id`, so a `<label for>` names it, and
`aria-label` names it where nothing else does. `tone="danger"` sets
`aria-invalid`.

The days, or the months, are a `grid`, and the two ends have
`aria-selected`. Each day is a button and its own tab stop: the grid has
no arrow keys.

`disabled` takes the field out of the tab order. A read-only field stays
in it and sets `aria-disabled`, since ARIA allows no `aria-readonly` on a
button, and its popup does not open.

## When not to use it

For one day, use [DatePicker](../date-picker/date-picker.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default          | Description                                                                                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required)    | `DateRange`                                                                                                                                                                                                 |                  | The two ends, start then end, each an ISO string or `null`.                                                                                                                                                       |
| `onChange` (required) | `(value: DateRange) => void`                                                                                                                                                                                |                  | The new pair, start first even when the range was picked backwards.                                                                                                                                               |
| `placeholder`         | `string`                                                                                                                                                                                                    | `'Set a range…'` | Shown in the field while no start is picked.                                                                                                                                                                      |
| `prefix`              | `string`                                                                                                                                                                                                    |                  | Words before the value on the field, in the muted tone, as a filter bar names a field inside its control: "Type:" in "Type: any". With one, the placeholder reads as a value would.                               |
| `granularity`         | `DateRangeGranularity`: `'day'`, `'month'`                                                                                                                                                                  | `'day'`          | What one pick is. `day` (the default) holds each end as an ISO instant, `2026-08-04T00:00:00Z`; `month` holds it as `2026-08`, for a span a calendar of days is too fine for: a tenancy, a contract, a term.      |
| `openEnd`             | `string`                                                                                                                                                                                                    |                  | The name of an end that has not come yet ("Ongoing"). With it, `[start, null]` is a settled range, not one waiting for its end: the trigger shows this name after the arrow, and the popup offers it as a button. |
| `aria-label`          | `string`                                                                                                                                                                                                    |                  | The accessible name, for a control with no visible label to point at it — a filter under a column header, where the header is the only caption. A control that has a `<label htmlFor>` should use that instead.   |
| `id`                  | `string`                                                                                                                                                                                                    |                  | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                               |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |                  | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws.                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`           | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                             |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |                  | The role or scale it is coloured from.                                                                                                                                                                            |
| `disabled`            | `boolean`                                                                                                                                                                                                   |                  | Not applicable: removed from the tab order and from form submission.                                                                                                                                              |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |                  | Not editable, but still focusable and still submitted.                                                                                                                                                            |
| `className`           | `string`                                                                                                                                                                                                    |                  | Added to the control's own classes.                                                                                                                                                                               |
