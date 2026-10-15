---
title: formatDuration
summary: 'Writes a length of time as a person reads it, 2h 30m or 1m 26s, from
  minutes, seconds or milliseconds.'
related: [DurationInput, formatBytes]
---

[//]: # 'written from format-duration.doc.yaml by pnpm docs:sync; edit that file, not this one'

# formatDuration

Writes a length of time as a person reads it, in the two largest units
it needs: `150` minutes is `2h 30m`, and `86000` milliseconds is
`1m 26s`.

## Import

```tsx
import { formatDuration } from '@bh/ui';
```

## Examples

The number is minutes unless `unit` names another: `ms`, `s` or `h`.
Minutes are what [DurationInput](../../../inputs/components/duration-input/duration-input.md)
holds, and what an estimate or time spent is counted in; a time measured
with `Date.now()` or `performance.now()` is `ms`.

How it is written depends on how long it is, not on the unit it was
counted in. Under a second it is milliseconds, `840ms`; under ten
seconds, seconds to a tenth, `2.9s`; under a minute, whole seconds; under
an hour, minutes and seconds, `1m 26s`; then hours and minutes,
`2h 5m`. A second part that is zero is left off, `3h` rather than
`3h 0m`, and a length that rounds up to the next unit is written in it.

**Minutes and milliseconds**

```tsx
import { Figure, Figures, formatDuration } from '@bh/ui';

export function AnyUnit() {
  return (
    <div className="grid w-480 grid-cols-2 gap-16">
      <Figures title="Minutes, the default">
        <Figure label="0" value={formatDuration(0)} />
        <Figure label="45" value={formatDuration(45)} />
        <Figure label="150" value={formatDuration(150)} />
        <Figure label="1,590" value={formatDuration(1590)} />
      </Figures>
      <Figures title="Milliseconds">
        <Figure label="840" value={formatDuration(840, { unit: 'ms' })} />
        <Figure label="2,900" value={formatDuration(2900, { unit: 'ms' })} />
        <Figure label="86,000" value={formatDuration(86_000, { unit: 'ms' })} />
        <Figure label="7,529,000" value={formatDuration(7_529_000, { unit: 'ms' })} />
      </Figures>
    </div>
  );
}
```

## Past a day

A length past a day stays in hours, `76h 5m`, so an estimate reads as
one. `days: true` counts whole days and hours instead, as a job that has
run for days reads best: `3d 4h`.

**Seventy-six hours, both ways**

```tsx
import { Figure, Figures, formatDuration } from '@bh/ui';

const HOUR = 3_600_000;

export function PastADay() {
  return (
    <div className="w-320">
      <Figures>
        <Figure
          label="In hours"
          note="unit: 'ms'"
          value={formatDuration(76 * HOUR, { unit: 'ms' })}
        />
        <Figure
          label="In days"
          note="days: true"
          value={formatDuration(76 * HOUR, { unit: 'ms', days: true })}
        />
        <Figure
          label="Under a day"
          note="days: true"
          value={formatDuration(20 * HOUR, { unit: 'ms', days: true })}
        />
      </Figures>
    </div>
  );
}
```

```ts
formatDuration(value: number, options?: FormatDurationOptions): string
```

A length of time in the two largest units it needs, a zero second part
left off: `150` is `2h 30m`, `45` is `45m`, `180` is `3h`. The number is
minutes unless `unit` says otherwise: `86000` with `unit: 'ms'` is
`1m 26s`.

Under a second it is milliseconds, `840ms`; under ten seconds, seconds to
a tenth, `2.9s`; under a minute, whole seconds, `15s`; under an hour,
minutes and seconds, `1m 26s`; then hours and minutes, `76h 5m`, or with
`days`, days and hours past a day, `3d 4h`.

Zero is written in the unit it was counted in, `0m` for minutes, not an
empty string: a stored zero is a real answer and has to look different
from nothing having been entered. A negative length keeps its sign; a
number that is not finite comes back as `String` writes it.

| Parameter          | Type                                                         | Default | Description                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required) | `number`                                                     |         | The length, in `unit`s.                                                                                                                                               |
| `options`          | `FormatDurationOptions`                                      | `{}`    | What the number counts, and whether past a day is written in days.                                                                                                    |
| `options.unit`     | `'ms' \| 's' \| 'min' \| 'h'`: `'ms'`, `'s'`, `'min'`, `'h'` | `'min'` | What the number counts: `ms`, `s`, `min` or `h`. Minutes unless given, as DurationInput holds them; a time measured with `Date.now()` or `performance.now()` is `ms`. |
| `options.days`     | `boolean`                                                    | `false` | Count whole days past a day: `3d 4h` rather than `76h`. Off unless given, so a length of work, an estimate or time spent, reads in hours.                             |

Returns `string`.
