---
title: Formats
summary: A format writes a value as text. bh registers its own; an app adds more.
order: 4
related: [Overview, Renderers, The resource contract]
---

[//]: # 'written from formats.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Formats

A format writes a value as text: `12.4 MiB`, `43%`, `Jul 13, 2026`. A
field names its format. A part may name another.

**Every format**

```tsx
import type { TemplateField, TemplateNode } from '@bh/template';
import { Template } from '@bh/ui';

const FIELDS: TemplateField[] = [
  { key: 'amount', label: 'Amount', type: { kind: 'number' } },
  { key: 'share', label: 'Share', type: { kind: 'number' } },
  { key: 'size', label: 'Size', type: { kind: 'number' } },
  { key: 'took', label: 'Took', type: { kind: 'number' } },
  { key: 'price', label: 'Price', type: { kind: 'number' } },
  { key: 'day', label: 'Day', type: { kind: 'date' } },
  { key: 'at', label: 'At', type: { kind: 'datetime' } },
  { key: 'title', label: 'Title', type: { kind: 'text' } },
  { key: 'notes', label: 'Notes', type: { kind: 'markdown' } },
  { key: 'body', label: 'Body', type: { kind: 'richtext' } },
];

const RECORD = {
  amount: 12400,
  share: 0.427,
  size: 13002342,
  took: 125,
  price: 12.5,
  day: '2026-07-13',
  at: '2026-07-13T09:05:00Z',
  title: 'As it is',
  notes: 'Read **the guide** first',
  body: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Open at nine."}]}]}',
};

const TEMPLATE: TemplateNode = {
  layout: 'grid',
  options: { columns: 2, gap: 3 },
  nodes: [
    { value: 'number', options: { mono: true, tone: 'gray' } },
    { field: 'amount', format: 'number' },
    { value: 'number, compact', options: { mono: true, tone: 'gray' } },
    { field: 'amount', format: { name: 'number', options: { notation: 'compact' } } },
    { value: 'percent', options: { mono: true, tone: 'gray' } },
    { field: 'share', format: 'percent' },
    { value: 'bytes', options: { mono: true, tone: 'gray' } },
    { field: 'size', format: 'bytes' },
    { value: 'bytes, per second', options: { mono: true, tone: 'gray' } },
    { field: 'size', format: { name: 'bytes', options: { per: 's' } } },
    { value: 'duration', options: { mono: true, tone: 'gray' } },
    { field: 'took', format: 'duration' },
    { value: 'money', options: { mono: true, tone: 'gray' } },
    { field: 'price', format: { name: 'money', options: { currency: 'EUR' } } },
    { value: 'date', options: { mono: true, tone: 'gray' } },
    { field: 'day', format: 'date' },
    { value: 'datetime', options: { mono: true, tone: 'gray' } },
    { field: 'at', format: 'datetime' },
    { value: 'relative', options: { mono: true, tone: 'gray' } },
    { field: 'at', format: 'relative' },
    { value: 'plain', options: { mono: true, tone: 'gray' } },
    { field: 'title', format: 'plain' },
    { value: 'markdown', options: { mono: true, tone: 'gray' } },
    { field: 'notes', format: 'markdown' },
    { value: 'rich', options: { mono: true, tone: 'gray' } },
    { field: 'body', format: 'rich' },
  ],
};

export function EveryFormat() {
  return (
    <Template
      template={TEMPLATE}
      record={RECORD}
      fields={FIELDS}
      context={{ timeZone: 'UTC', now: new Date('2026-07-13T12:00:00Z') }}
    />
  );
}
```

## The registry

`defineFormat` checks a format's name, kinds, options schema and
function, and types it by its options.

`packages/shared/template/src/format/registry.ts`, line 1:

```ts
import * as v from 'valibot';
import { formatData, type FormatSpec, type Json } from '@bh/resource';
import { defineRegistry, type RegistryOf } from '@bh/registry';
import { functionSchema, optionsSchema } from '../registry';
import type { FormatPiece } from './pieces';

/** A value of its field's kind, never null. */
export type FormatValue = Exclude<Json, null>;

/** What the app sets once, for every format. */
export interface FormatContext {
  /** A BCP 47 tag: `de`, `en-GB`. Default English. */
  locale?: string;
  /** `UTC` or an IANA zone. Default the reader's. A format's own `timeZone` wins. */
  timeZone?: string;
  /** What relative times count from. Default now. */
  now?: Date;
}

/** No options. */
export type NoOptions = Record<string, never>;

/** A format: its spec and its function. `O` is its options. */
export interface Formatter<O = NoOptions> extends FormatSpec {
  /** Its options' schema. None: it takes none. */
  options?: v.GenericSchema<unknown, O>;
  /** The value as pieces. Gets checked options; `{}` when none. */
  format: (value: FormatValue, options: O, context: FormatContext) => FormatPiece[];
}

/** Formats by name. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormatRegistry = RegistryOf<Formatter<any>>;

/** What the registry checks of a format. */
const formatterData = v.object({
  ...formatData.entries,
  options: v.optional(optionsSchema),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  format: functionSchema<Formatter<any>['format']>('its format'),
});

/** The empty format registry. `baseFormats` registers bh's on it. */
export const noFormats = defineRegistry({
  name: 'format',
  schema: formatterData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  define: <O>(format: Formatter<O>): Formatter<any> => format,
});

/** Defines a format: checks it, types it by its options. */
export const defineFormat = noFormats.define;
```

## The formats

A field names a format alone, `'bytes'`, or with options,
`{ "name": "bytes", "options": { "per": "s" } }`. Options its schema
refuses fail the field's metadata.

| Name       | Description                                     | Kinds                                   | Options                  |
| ---------- | ----------------------------------------------- | --------------------------------------- | ------------------------ |
| `number`   | 1234.5 as `1,234.5`; compact, 12400 as `12.4K`. | number                                  | `digits`, `notation`     |
| `percent`  | A fraction as a percent: 0.427 as `43%`.        | number                                  | `digits`                 |
| `bytes`    | A size: `12.4 MiB`. A rate: `12.4 MiB/s`.       | number                                  | `units`, `digits`, `per` |
| `duration` | A length of time: `2h 5m`, `840ms`.             | number                                  | `unit`, `days`           |
| `money`    | An amount in a currency: `€12.50`.              | number                                  | `currency` (required)    |
| `date`     | A day: `Jul 13, 2026`.                          | date                                    |                          |
| `datetime` | A date and a clock: `Jul 13, 2026, 09:05`.      | datetime                                | `timeZone`               |
| `relative` | Counted from now: `3 days ago`, `in 2 hours`.   | date, datetime                          | `smallestUnit`           |
| `plain`    | The text as it is.                              | text, markdown, url, email, phone, time |                          |
| `markdown` | Markdown without its marks.                     | markdown, text                          |                          |
| `rich`     | A rich text's words, a block to a line.         | richtext                                |                          |

### number

`packages/shared/template/src/base/formats/number.ts`, line 1:

```ts
import * as v from 'valibot';
import { defineFormat } from '../../format/registry';
import { digits, writeNumber } from '../../format/write';

const numberOptions = v.optional(
  v.strictObject({
    /** Most digits after the point. Default 3. */
    digits: v.optional(digits),
    /** `compact`: 12400 as `12.4K`. */
    notation: v.optional(v.literal('compact')),
  }),
  {},
);

export type NumberOptions = v.InferOutput<typeof numberOptions>;

/** 1234.5 as `1,234.5`; compact, 12400 as `12.4K`. */
export const numberFormat = defineFormat({
  name: 'number',
  kinds: ['number'],
  options: numberOptions,
  format: (value, { digits: most, notation }, context) => {
    return writeNumber(value, context, {
      ...(most === undefined ? {} : { maximumFractionDigits: most }),
      ...(notation === undefined ? {} : { notation }),
    });
  },
});
```

### percent

`packages/shared/template/src/base/formats/percent.ts`, line 1:

```ts
import * as v from 'valibot';
import { defineFormat } from '../../format/registry';
import { digits, writeNumber } from '../../format/write';

const percentOptions = v.optional(
  v.strictObject({
    /** Most digits after the point. Default 0. */
    digits: v.optional(digits),
  }),
  {},
);

export type PercentOptions = v.InferOutput<typeof percentOptions>;

/** A fraction as a percent: 0.427 as `43%`. */
export const percentFormat = defineFormat({
  name: 'percent',
  kinds: ['number'],
  options: percentOptions,
  format: (value, { digits: most = 0 }, context) => {
    return writeNumber(value, context, { style: 'percent', maximumFractionDigits: most });
  },
});
```

### bytes

`packages/shared/template/src/base/formats/bytes.ts`, line 1:

```ts
import * as v from 'valibot';
import { sizeOf } from '../../format/bytes';
import { measuresAsPieces } from '../../format/pieces';
import { defineFormat } from '../../format/registry';
import { digits, isNumber, plainPieces } from '../../format/write';

const bytesOptions = v.optional(
  v.strictObject({
    /** `binary` (KiB, MiB) or `decimal` (kB, MB). Default `binary`. */
    units: v.optional(v.picklist(['binary', 'decimal'])),
    /** Most digits after the point. Default 1. */
    digits: v.optional(digits),
    /** A rate, per `s`, `min` or `h`: `12.4 MiB/s`. */
    per: v.optional(v.picklist(['s', 'min', 'h'])),
  }),
  {},
);

export type BytesOptions = v.InferOutput<typeof bytesOptions>;

/** A size: `12.4 MiB`. A rate: `12.4 MiB/s`. */
export const bytesFormat = defineFormat({
  name: 'bytes',
  kinds: ['number'],
  options: bytesOptions,
  format: (value, { per, ...size }) => {
    const measure = isNumber(value) ? sizeOf(value, size) : undefined;
    return measure === undefined
      ? plainPieces(value)
      : measuresAsPieces([measure], { gap: ' ', suffix: per === undefined ? '' : `/${per}` });
  },
});
```

### duration

`packages/shared/template/src/base/formats/duration.ts`, line 1:

```ts
import * as v from 'valibot';
import { partsOf } from '../../format/duration';
import { measuresAsPieces } from '../../format/pieces';
import { defineFormat } from '../../format/registry';
import { isNumber, plainPieces } from '../../format/write';

const durationOptions = v.optional(
  v.strictObject({
    /** The number's unit: `ms`, `s`, `min` or `h`. Default `min`. */
    unit: v.optional(v.picklist(['ms', 's', 'min', 'h'])),
    /** Days past a day: `3d 4h`. Default off. */
    days: v.optional(v.boolean()),
  }),
  {},
);

export type DurationOptions = v.InferOutput<typeof durationOptions>;

/** A length of time: `2h 5m`, `840ms`. */
export const durationFormat = defineFormat({
  name: 'duration',
  kinds: ['number'],
  options: durationOptions,
  format: (value, options) => {
    const parts = isNumber(value) ? partsOf(value, options) : undefined;
    return parts === undefined ? plainPieces(value) : measuresAsPieces(parts);
  },
});
```

### money

`packages/shared/template/src/base/formats/money.ts`, line 1:

```ts
import * as v from 'valibot';
import { defineFormat } from '../../format/registry';
import { writeNumber } from '../../format/write';

const moneyOptions = v.strictObject({
  /** An ISO 4217 code: `EUR`, `USD`. Required. */
  currency: v.pipe(
    v.string(),
    v.regex(/^[A-Z]{3}$/, 'a currency is an ISO 4217 code, three capital letters: EUR'),
  ),
});

export type MoneyOptions = v.InferOutput<typeof moneyOptions>;

/** An amount in a currency: `€12.50`. */
export const moneyFormat = defineFormat({
  name: 'money',
  kinds: ['number'],
  options: moneyOptions,
  format: (value, { currency }, context) => {
    return writeNumber(value, context, { style: 'currency', currency });
  },
});
```

### date

`packages/shared/template/src/base/formats/date.ts`, line 1:

```ts
import { formatExact } from '../../format/dates';
import { defineFormat } from '../../format/registry';
import { isMoment, plainPieces } from '../../format/write';

/** A day: `Jul 13, 2026`. */
export const dateFormat = defineFormat({
  name: 'date',
  kinds: ['date'],
  format: (value, _options, { locale }) => {
    return isMoment(value) ? [{ text: formatExact(value, { locale }) }] : plainPieces(value);
  },
});
```

### datetime

`packages/shared/template/src/base/formats/datetime.ts`, line 1:

```ts
import * as v from 'valibot';
import { formatDateTime } from '../../format/date-time';
import { defineFormat } from '../../format/registry';
import { isMoment, plainPieces } from '../../format/write';

/** Whether Intl knows the zone. */
function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const datetimeOptions = v.optional(
  v.strictObject({
    /** The clock's zone: `UTC`, `Asia/Tbilisi`. Default the app's. */
    timeZone: v.optional(
      v.pipe(v.string(), v.check(isTimeZone, 'a time zone Intl knows: UTC, Asia/Tbilisi')),
    ),
  }),
  {},
);

export type DatetimeOptions = v.InferOutput<typeof datetimeOptions>;

/** A date and a clock: `Jul 13, 2026, 09:05`. */
export const datetimeFormat = defineFormat({
  name: 'datetime',
  kinds: ['datetime'],
  options: datetimeOptions,
  format: (value, { timeZone }, context) => {
    return isMoment(value)
      ? [
          {
            text: formatDateTime(value, {
              locale: context.locale,
              timeZone: timeZone ?? context.timeZone,
            }),
          },
        ]
      : plainPieces(value);
  },
});
```

### relative

`packages/shared/template/src/base/formats/relative.ts`, line 1:

```ts
import * as v from 'valibot';
import { relativeLabel } from '../../format/dates';
import { defineFormat } from '../../format/registry';
import { isMoment, plainPieces } from '../../format/write';

const relativeOptions = v.optional(
  v.strictObject({
    /** `day` or `minute`. Default `day` for a date, `minute` for a moment. */
    smallestUnit: v.optional(v.picklist(['day', 'minute'])),
  }),
  {},
);

export type RelativeOptions = v.InferOutput<typeof relativeOptions>;

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Counted from now: `3 days ago`, `in 2 hours`. */
export const relativeFormat = defineFormat({
  name: 'relative',
  kinds: ['date', 'datetime'],
  options: relativeOptions,
  format: (value, { smallestUnit }, { locale, now = new Date() }) => {
    return isMoment(value)
      ? [
          {
            text: relativeLabel(value, now, {
              locale,
              smallestUnit: smallestUnit ?? (DAY_ONLY.test(value) ? 'day' : 'minute'),
            }),
          },
        ]
      : plainPieces(value);
  },
});
```

### plain

`packages/shared/template/src/base/formats/plain.ts`, line 1:

```ts
import { defineFormat } from '../../format/registry';
import { plainPieces } from '../../format/write';

/** The text as it is. */
export const plainFormat = defineFormat({
  name: 'plain',
  kinds: ['text', 'markdown', 'url', 'email', 'phone', 'time'],
  format: plainPieces,
});
```

### markdown

`packages/shared/template/src/base/formats/markdown.ts`, line 1:

```ts
import { readMarkdown } from '../../format/reading';
import { defineFormat } from '../../format/registry';
import { asText } from '../../format/write';

/** Markdown without its marks. */
export const markdownFormat = defineFormat({
  name: 'markdown',
  kinds: ['markdown', 'text'],
  format: (value) => {
    return [{ text: readMarkdown(asText(value)) }];
  },
});
```

### rich

`packages/shared/template/src/base/formats/rich.ts`, line 1:

```ts
import { readRichText } from '../../format/reading';
import { defineFormat } from '../../format/registry';
import { asText } from '../../format/write';

/** A rich text's words, a block to a line. */
export const richFormat = defineFormat({
  name: 'rich',
  kinds: ['richtext'],
  format: (value) => {
    return [{ text: readRichText(asText(value)) }];
  },
});
```

## Registering them

`baseFormats` registers bh's formats.

`packages/shared/template/src/format/base-formats.ts`, line 1:

```ts
import { bytesFormat, type BytesOptions } from '../base/formats/bytes';
import { dateFormat } from '../base/formats/date';
import { datetimeFormat, type DatetimeOptions } from '../base/formats/datetime';
import { durationFormat, type DurationOptions } from '../base/formats/duration';
import { markdownFormat } from '../base/formats/markdown';
import { moneyFormat, type MoneyOptions } from '../base/formats/money';
import { numberFormat, type NumberOptions } from '../base/formats/number';
import { percentFormat, type PercentOptions } from '../base/formats/percent';
import { plainFormat } from '../base/formats/plain';
import { relativeFormat, type RelativeOptions } from '../base/formats/relative';
import { richFormat } from '../base/formats/rich';
import { noFormats, type NoOptions } from './registry';

/** bh's formats, by name, with their options. */
export interface BaseFormats {
  number: NumberOptions;
  percent: PercentOptions;
  bytes: BytesOptions;
  duration: DurationOptions;
  money: MoneyOptions;
  date: NoOptions;
  datetime: DatetimeOptions;
  relative: RelativeOptions;
  plain: NoOptions;
  markdown: NoOptions;
  rich: NoOptions;
}

/** bh's eleven formats. */
export const baseFormats = noFormats.register({
  number: numberFormat,
  percent: percentFormat,
  bytes: bytesFormat,
  duration: durationFormat,
  money: moneyFormat,
  date: dateFormat,
  datetime: datetimeFormat,
  relative: relativeFormat,
  plain: plainFormat,
  markdown: markdownFormat,
  rich: richFormat,
});
```

## Your own format

Define a format with `defineFormat`, then register it. `register` returns
a new registry; `baseFormats` is unchanged.

A format returns pieces. A piece with `unit: true` can be drawn smaller.
`formatText` joins the pieces. The function gets the value, its checked
options, and the app's `locale`, `timeZone` and `now`.

```ts
import * as v from 'valibot';
import { createRegistry } from '@bh/resource';
import { baseFormats, checkFormats, defineFormat } from '@bh/template';

const rate = defineFormat({
  name: 'rate',
  kinds: ['number'],
  options: v.optional(v.strictObject({ per: v.optional(v.picklist(['page', 'visit'])) }), {}),
  format: (value, { per = 'page' }, { locale }) => {
    return typeof value === 'number'
      ? [{ text: value.toLocaleString(locale) }, { text: ` per ${per}`, unit: true }]
      : [{ text: String(value) }];
  },
});

export const formats = baseFormats.register({ rate });

// Throws when a kind's default format is missing.
checkFormats(formats);

// Checks each field's format against these.
export const registry = createRegistry({ formats });
```

```ts
interface Formatter<O = NoOptions> extends FormatSpec
```

A format: its spec and its function. `O` is its options.

| Member              | Type                                                                        | Default | Description                                                |
| ------------------- | --------------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `name` (required)   | `string`                                                                    |         | 'money'                                                    |
| `kinds` (required)  | `FieldKind[]`                                                               |         | The kinds it formats: ['number'].                          |
| `options`           | `v.GenericSchema<unknown, O>`                                               |         | Its options' schema. None: it takes none.                  |
| `format` (required) | `(value: FormatValue, options: O, context: FormatContext) => FormatPiece[]` |         | The value as pieces. Gets checked options; `{}` when none. |

```ts
formatValue(formats, format, value, context?): FormatPiece[]
```

A value as pieces in a format. An unknown format, or refused options, give
the value's own text.

| Parameter            | Type                       | Default | Description                                                       |
| -------------------- | -------------------------- | ------- | ----------------------------------------------------------------- |
| `formats` (required) | `FormatRegistry`           |         | The format registry: `baseFormats`, or an app's.                  |
| `format` (required)  | `FieldFormat \| undefined` |         | A format's name, or its name and options. None: the value's text. |
| `value` (required)   | `FormatValue`              |         | One value of the field's kind.                                    |
| `context`            | `FormatContext`            | `{}`    | The app's locale, time zone and now.                              |

Returns `FormatPiece[]`.
