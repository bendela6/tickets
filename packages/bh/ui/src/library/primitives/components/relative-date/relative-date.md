---
title: RelativeDate
summary: 'Shows a date as days from now: today, in 3 days, 2 days ago.'
related: [DatePicker, DateRangePicker]
---

[//]: # 'written from relative-date.doc.yaml by pnpm docs:sync; edit that file, not this one'

# RelativeDate

Shows a date as days from now: today, in 3 days, 2 days ago.

It counts whole calendar days in UTC, so the time of day does not change
the answer. The exact date, such as `Jul 13, 2026`, is its `title`.

## Import

```tsx
import { RelativeDate } from '@bh/ui';
```

## Examples

Each date is counted from `now`, the current time unless given. One day
either way reads `tomorrow` or `yesterday`.

**Days from now**

```tsx
import { RelativeDate } from '@bh/ui';

const NOW = new Date('2026-07-06T09:00:00Z');

export function DaysFromNow() {
  return (
    <div className="flex flex-col gap-4">
      <RelativeDate value="2026-07-03T09:00:00Z" now={NOW} />
      <RelativeDate value="2026-07-05T18:30:00Z" now={NOW} />
      <RelativeDate value="2026-07-06T23:00:00Z" now={NOW} />
      <RelativeDate value="2026-07-07T08:00:00Z" now={NOW} />
      <RelativeDate value="2026-07-13T09:00:00Z" now={NOW} />
    </div>
  );
}
```

`overdue` draws the date in red. It does not look at the date itself:
the caller decides when a date is overdue.

**Overdue**

```tsx
import { RelativeDate } from '@bh/ui';

const NOW = new Date('2026-07-06T09:00:00Z');

export function Overdue() {
  return (
    <div className="flex flex-col gap-4">
      <RelativeDate value="2026-07-03T09:00:00Z" now={NOW} overdue />
      <RelativeDate value="2026-07-09T09:00:00Z" now={NOW} />
    </div>
  );
}
```

## Props

| Prop               | Type      | Default      | Description                                                         |
| ------------------ | --------- | ------------ | ------------------------------------------------------------------- |
| `value` (required) | `string`  |              | The date, as a string `new Date()` reads, such as an ISO timestamp. |
| `now`              | `Date`    | `new Date()` | The moment to count from. Unset, the current time.                  |
| `overdue`          | `boolean` |              | Style overdue past dates in danger (for due-date fields).           |
| `className`        | `string`  |              | Added to the `<span>`'s own classes.                                |
