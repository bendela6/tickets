---
title: useNow
summary: The time now, ticking every second or every interval it is given, on
  one timer for every clock on the page, for a countdown or a "saved 3 minutes
  ago".
order: 3
related: [Writing a hook, RelativeDate]
---

[//]: # 'written from use-now.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useNow

The time now, in milliseconds as `Date.now()` gives it, ticking every
second or every `interval` it is given: a "saved 3 minutes ago", a
countdown, a clock. How the time is shown is the caller's.

## Import

```tsx
import { useNow } from '@bh/hooks';
```

## Examples

**Saved a while ago**

```tsx
import { useState } from 'react';
import { useNow } from '@bh/hooks';

// How long ago a note was saved, said again each second, and a clock that
// turns on the minute: plain text and a button, no component of bh's.

const BUTTON = 'rounded-8 border-gray-6 border-1 px-12 py-6';

function ago(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return seconds < 60 ? `${String(seconds)} s ago` : `${String(Math.floor(seconds / 60))} min ago`;
}

export function SavedAWhileAgo() {
  const [savedAt, setSavedAt] = useState<number>();
  const [ticking, setTicking] = useState(true);
  const now = useNow({ enabled: ticking });
  const minute = useNow({ interval: 60_000 });
  return (
    <div className="flex flex-col items-start gap-8">
      <p className="text-13/19 text-gray-11 tabular-nums">
        {savedAt === undefined ? 'Not saved yet' : `Saved ${ago(now - savedAt)}`}
      </p>
      <div className="flex gap-8">
        <button type="button" className={BUTTON} onClick={() => setSavedAt(Date.now())}>
          Save
        </button>
        <button type="button" className={BUTTON} onClick={() => setTicking(!ticking)}>
          {ticking ? 'Stop the clock' : 'Start the clock'}
        </button>
      </div>
      <p className="text-12/17 text-gray-10 font-mono" suppressHydrationWarning>
        {new Date(minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
```

Click **Save**, and the line above says how long ago, again each
second. **Stop the clock** passes `enabled: false`, and the line keeps
the time it last had; started again, it says the time at once. The
time under the buttons ticks every minute, on the minute.

It returns a number, so the time since something is a subtraction:
`now - savedAt`. `new Date(now)` gives it as a date to format.

For a moment in words, [RelativeDate](../../ui/src/library/primitives/components/relative-date/relative-date.md)
with `smallestUnit="minute"` already does this: it holds a `useNow` at
the slowest interval its label can change at, a minute under an hour
away and an hour under a day, and none beyond.

## Rules

- **Its server value is the time it renders at.** A page built ahead
  of time shows its build's time until the browser takes it over, so
  mark the element that shows it with `suppressHydrationWarning`.
- **It ticks on a whole multiple of the interval**, as a clock's
  second hand does, not an interval after it mounted: every `useNow`
  on the page with the same interval ticks on one timer, together, and
  a minute's clock turns on the minute.
- **A tab coming back into view** says the time at once, since a
  browser slows the timers of a tab in the background.
- **`enabled: false`** keeps the time it last had, and ticks nothing;
  an `interval` that is no positive number never ticks either.
- **Cleaning up**: its share of the timer goes with the component, and
  the timer with the last clock at its interval.

## Reference

```ts
useNow(options?: UseNowOptions): number
```

The time now, in milliseconds since the epoch as `Date.now()` gives it,
ticking every `interval`: a "saved 3 minutes ago", a countdown, a clock.
Every `useNow` on the page with the same interval ticks on the same timer,
on a whole multiple of the interval, so they move together and a minute's
clock turns on the minute. `new Date(now)` gives it as a date.

Its server value is the time it renders at. A page built ahead of time
shows its build's time until the browser takes it over, so mark what
shows it with `suppressHydrationWarning`.

| Parameter          | Type            | Default | Description                                                                                                                                                               |
| ------------------ | --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options`          | `UseNowOptions` | `{}`    |                                                                                                                                                                           |
| `options.interval` | `number`        | `1000`  | How often it ticks, in milliseconds: every second unless given. Each tick is on a whole multiple of it, as a clock's second hand is; one that is not above 0 never ticks. |
| `options.enabled`  | `boolean`       | `true`  | Whether it ticks; while `false` it keeps the time it last had. `true` unless given.                                                                                       |

Returns `number`.

```ts
interface UseNowOptions
```

What `useNow` takes. Every option is optional: `useNow()`.

| Member     | Type      | Default | Description                                                                                                                                                               |
| ---------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interval` | `number`  |         | How often it ticks, in milliseconds: every second unless given. Each tick is on a whole multiple of it, as a clock's second hand is; one that is not above 0 never ticks. |
| `enabled`  | `boolean` |         | Whether it ticks; while `false` it keeps the time it last had. `true` unless given.                                                                                       |
