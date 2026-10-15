---
title: RelativeDate
summary: 'Shows a date as days from now (today, in 3 days), or a moment as
  minutes and hours (5 minutes ago); formatDateTime writes one out with its
  time.'
related: [DatePicker, DateRangePicker, useNow]
---

[//]: # 'written from relative-date.doc.yaml by pnpm docs:sync; edit that file, not this one'

# RelativeDate

Shows a date as days from now: today, in 3 days, 2 days ago. Given
`smallestUnit="minute"`, a moment less than a day away reads in minutes
and hours instead, 5 minutes ago, and keeps itself current.

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

## Minutes and hours

A due date is a day, and reads best in days. A moment, such as when
something was saved or last seen, reads best closer in:
`smallestUnit="minute"` counts one less than a day away in whole
minutes and hours, `5 minutes ago` or `in 2 hours`, and one a day or
more away in calendar days, as above. Unset, `smallestUnit` is `day`,
so a label that counted days still does.

**The same moments, in minutes and in days**

```tsx
import { Fragment } from 'react';
import { RelativeDate } from '@bh/ui';

const NOW = new Date('2026-07-06T09:00:00Z');
const MOMENTS = [
  '2026-07-06T08:59:40Z',
  '2026-07-06T08:55:00Z',
  '2026-07-06T06:30:00Z',
  '2026-07-06T11:00:00Z',
  '2026-07-05T08:00:00Z',
];

export function MinutesAndHours() {
  return (
    <div className="grid grid-cols-2 items-baseline gap-x-24 gap-y-8">
      <span className="text-12/17 text-gray-9 font-mono">minute</span>
      <span className="text-12/17 text-gray-9 font-mono">day, the default</span>
      {MOMENTS.map((moment) => {
        return (
          <Fragment key={moment}>
            <RelativeDate value={moment} now={NOW} smallestUnit="minute" />
            <RelativeDate value={moment} now={NOW} />
          </Fragment>
        );
      })}
    </div>
  );
}
```

- **Under a minute either way is `just now`**, so a moment a server
  stamped a second ahead of the reader's clock does not read
  `in 0 minutes`.
- **Minutes and hours are counted down**: `5 minutes ago` is five whole
  minutes gone and not yet six, and `1 hour ago` lasts until the second
  hour is up.
- **Its title is the date and its time**, as `formatDateTime` below
  writes them, in the reader's own zone, where a label in days has the
  date alone.
- **`relativeLabel` counts the same way** given `smallestUnit: 'minute'`.

While `now` is unset, a label in minutes keeps itself current with
[useNow](../../../../../../hooks/docs/use-now.md), turning only as often as it can change: each
minute under an hour away, each hour under a day away, and not at all
beyond, where it counts days. Every label on the page at one step
shares one timer, which turns on the minute or the hour, so a label can
lag its moment by up to that step. The two lines below were set a little
short of their next step when the example opened; click **Save** and
watch the line under them.

**Keeping itself current**

```tsx
import { Fragment, useState } from 'react';
import { Button, RelativeDate } from '@bh/ui';

const MINUTE = 60_000;

// Two moments set from when the example opened, each a little short of its
// label's next step, so each turns within a minute or two of watching.
const BEFORE = [
  { note: '30 s before it opened', ms: 30_000 },
  { note: '59 min 30 s before', ms: 59 * MINUTE + 30_000 },
];

export function StaysCurrent() {
  const [opened] = useState(() => Date.now());
  const [savedAt, setSavedAt] = useState<string>();
  return (
    <div className="flex flex-col items-start gap-12">
      <div className="grid grid-cols-2 items-baseline gap-x-24 gap-y-8">
        {BEFORE.map(({ note, ms }) => {
          return (
            <Fragment key={note}>
              <span className="text-12/17 text-gray-9 font-mono">{note}</span>
              <RelativeDate value={new Date(opened - ms).toISOString()} smallestUnit="minute" />
            </Fragment>
          );
        })}
      </div>
      <p className="text-13/19 text-gray-11">
        {savedAt === undefined ? (
          'Not saved yet'
        ) : (
          <>
            Saved <RelativeDate value={savedAt} smallestUnit="minute" />
          </>
        )}
      </p>
      <Button onClick={() => setSavedAt(new Date().toISOString())}>Save</Button>
    </div>
  );
}
```

On a server, which runs no effect, it draws the label for the time it
renders at and starts no timer. The browser's time is later, so the
label is marked `suppressHydrationWarning`, as `useNow` asks.

## Props

| Prop               | Type                                     | Default | Description                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ---------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required) | `string`                                 |         | The date, as a string `new Date()` reads, such as an ISO timestamp.                                                                                                                                                                                                                                                                                  |
| `now`              | `Date`                                   |         | The moment to count from. Unset, the current time.                                                                                                                                                                                                                                                                                                   |
| `locale`           | `string`                                 |         | The locale to write in, as a BCP 47 tag such as `ka` or `de`: the label and its title in that language. Unset, English.                                                                                                                                                                                                                              |
| `smallestUnit`     | `'day' \| 'minute'`: `'day'`, `'minute'` | `'day'` | The smallest step it counts in. `day`, the default, for a day such as a due date: whole calendar days, with the date as its title. `minute` for a moment such as when something was saved: under a day away it reads `just now`, `5 minutes ago` or `in 2 hours`, keeps itself current while `now` is unset, and has the date and time as its title. |
| `overdue`          | `boolean`                                |         | Style overdue past dates in danger (for due-date fields).                                                                                                                                                                                                                                                                                            |
| `className`        | `string`                                 |         | Added to the `<span>`'s own classes.                                                                                                                                                                                                                                                                                                                 |

The label and the title it writes are exported too:

```ts
relativeLabel(value: string, now: Date, options?: RelativeLabelOptions): string
```

A date as whole calendar days from `now`, counted in UTC: `today`,
`tomorrow`, `yesterday`, `in 3 days`, `2 days ago`. With `smallestUnit:
'minute'`, a moment less than a day away reads in whole minutes and hours
instead: `just now`, `5 minutes ago`, `in 2 hours`. Given a `locale`, in
that locale's words, its own for the near days too: `vorgestern` and
`vor 5 Minuten` in `de`.

| Parameter              | Type                                     | Default | Description                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required)     | `string`                                 |         | The date, as a string `new Date()` reads, such as an ISO timestamp.                                                                                                                                                                                                                                                                             |
| `now` (required)       | `Date`                                   |         | The moment to count from.                                                                                                                                                                                                                                                                                                                       |
| `options`              | `RelativeLabelOptions`                   | `{}`    | The smallest step it counts in, and the language to write in.                                                                                                                                                                                                                                                                                   |
| `options.locale`       | `string`                                 |         | The locale to write in, as a BCP 47 tag such as `ka`, `en-GB` or `de-CH`: its words and their order, from `Intl`. Unset, bh's own English: `Jul 13, 2026`, `in 3 days`.                                                                                                                                                                         |
| `options.smallestUnit` | `'day' \| 'minute'`: `'day'`, `'minute'` | `'day'` | The smallest step it counts in. `day`, the default, counts whole calendar days in UTC, as a due date wants: `today`, `in 3 days`. `minute` counts a moment less than a day away in whole minutes and hours, as the time something was saved wants: `just now`, `5 minutes ago`, `in 2 hours`; a day or more away, it counts days as `day` does. |

Returns `string`.

```ts
formatExact(value: string, options?: DateLocaleOptions): string
```

A date as `Jul 13, 2026`: its calendar day in UTC. Given a `locale`, that
locale's medium date, still in UTC: `13 Jul 2026` in `en-GB`.

| Parameter          | Type                | Default | Description                                                                                                                                                             |
| ------------------ | ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required) | `string`            |         | The date, as a string `new Date()` reads, such as an ISO timestamp.                                                                                                     |
| `options`          | `DateLocaleOptions` | `{}`    | The language to write in.                                                                                                                                               |
| `options.locale`   | `string`            |         | The locale to write in, as a BCP 47 tag such as `ka`, `en-GB` or `de-CH`: its words and their order, from `Intl`. Unset, bh's own English: `Jul 13, 2026`, `in 3 days`. |

Returns `string`.

## Date and time

Where the day alone is not enough, as for when a job ran or a page was
saved, `formatDateTime` writes the moment out: the date as the `title`
above writes it, then the time on a 24-hour clock, `Jul 13, 2026, 09:05`.
It comes from `@bh/ui`, as `RelativeDate` does.

RelativeDate counts calendar days in UTC, since a day is the same
everywhere. A time of day is not, so the clock reads in the reader's own
zone unless `timeZone` names another: `UTC`, or an IANA zone such as
`Europe/Tbilisi` for a place's own clock. `seconds` adds the seconds, as
a log wants them.

**One moment, four ways**

```tsx
import { Figure, Figures, formatDateTime } from '@bh/ui';

const AT = '2026-07-13T09:05:30Z';

export function DateAndTime() {
  return (
    <div className="w-400">
      <Figures>
        <Figure label="Your zone" note="no timeZone" value={formatDateTime(AT)} />
        <Figure
          label="UTC"
          note="timeZone: 'UTC'"
          value={formatDateTime(AT, { timeZone: 'UTC' })}
        />
        <Figure
          label="New York"
          note="timeZone: 'America/New_York'"
          value={formatDateTime(AT, { timeZone: 'America/New_York' })}
        />
        <Figure
          label="With seconds"
          note="seconds: true"
          value={formatDateTime(AT, { timeZone: 'UTC', seconds: true })}
        />
      </Figures>
    </div>
  );
}
```

```ts
formatDateTime(value: string | Date, options?: FormatDateTimeOptions): string
```

A moment as its date and time of day, `Jul 13, 2026, 09:05`, on a 24-hour
clock in the reader's zone unless `timeZone` names another. The date is
written as `formatExact` writes it. Given a `locale`, that locale's
medium date and short time: `13 Jul 2026, 09:05` in `en-GB`,
`Jul 13, 2026, 9:05 AM` in `en-US`.

A string no `Date` can read comes back as it was written, where `Intl`
would throw; an invalid `Date` comes back as `Invalid Date`.

| Parameter          | Type                    | Default | Description                                                                                                                                                             |
| ------------------ | ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required) | `string \| Date`        |         | The moment: a `Date`, or a string `new Date()` reads, such as an ISO timestamp.                                                                                         |
| `options`          | `FormatDateTimeOptions` | `{}`    | The language, the zone the clock reads in, and whether it shows seconds.                                                                                                |
| `options.locale`   | `string`                |         | The locale to write in, as a BCP 47 tag such as `ka`, `en-GB` or `de-CH`: its words and their order, from `Intl`. Unset, bh's own English: `Jul 13, 2026`, `in 3 days`. |
| `options.timeZone` | `string`                |         | The zone the clock reads in: `UTC`, or an IANA zone such as `Europe/Tbilisi` for a place's own clock. Unset, the reader's own zone.                                     |
| `options.seconds`  | `boolean`               | `false` | Show the seconds: `09:05:30` rather than `09:05`.                                                                                                                       |

Returns `string`.

## In another language

Each of these writes English until it is given a `locale`, a BCP 47 tag
such as `ka`, `en-GB` or `de-CH`: RelativeDate takes it as a prop, and
`relativeLabel`, `formatExact` and `formatDateTime` as an option. bh keeps
no translations of its own, so an app that translates passes in the
locale it already has.

In a locale the words, their order and the clock are that locale's own,
from `Intl`: `in 3 days` is `in 3 Tagen` in `de`, two days back is
`vorgestern` rather than `vor 2 Tagen`, `5 minutes ago` is
`vor 5 Minuten` and `just now` the locale's own `jetzt`, and `en-US`
writes `2:30 PM` where the English without a locale writes `14:30`.
Only the writing changes: days are still counted in UTC, and the clock
still reads in the zone it is given. A tag `Intl` cannot read, such as
`en_US`, is ignored.

**The same moments, by locale**

```tsx
import { Fragment } from 'react';
import { formatDateTime, RelativeDate } from '@bh/ui';

const NOW = new Date('2026-07-06T09:00:00Z');
const AT = '2026-07-09T14:30:00Z';
const SAVED = '2026-07-06T08:55:00Z';
const LOCALES = [undefined, 'en-US', 'en-GB', 'de', 'fr'];

export function InAnotherLanguage() {
  return (
    <div className="grid grid-cols-4 items-baseline gap-x-24 gap-y-8">
      {LOCALES.map((locale) => {
        return (
          <Fragment key={locale ?? 'none'}>
            <span className="text-12/17 text-gray-9 font-mono">{locale ?? 'no locale'}</span>
            <RelativeDate value={AT} now={NOW} locale={locale} />
            <RelativeDate value={SAVED} now={NOW} locale={locale} smallestUnit="minute" />
            <span className="text-12/17 text-gray-12 font-mono tabular-nums">
              {formatDateTime(AT, { locale, timeZone: 'UTC' })}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
```

> [!WARNING]
> **The browser has to know the language**
>
> `Intl` writes only the languages its runtime carries data for, and
> any other in the runtime's default, with no error. Some Chrome
> builds carry no Georgian, so there `ka` comes out in English. An app
> whose language may be missing can ask first:
> `Intl.DateTimeFormat.supportedLocalesOf(['ka'])` is empty where it is.
