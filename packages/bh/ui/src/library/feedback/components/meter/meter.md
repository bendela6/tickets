---
title: Meter
summary: 'A share of a whole as a bar: its name, its percent, a caption, and a
  tone for how full it is.'
related: [Progress, Figures, CardState]
---

[//]: # 'written from meter.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Meter

A share of a whole as a bar: its name, its percent, a caption, and a
tone for how full it is.

It is for a measurement within a known range, like memory or a disk in
use. For how far along a job is, use
[Progress](../progress/progress.md).

## Import

```tsx
import { Meter, meterTone, type MeterMark } from '@bh/ui';
```

## Examples

`fraction` is the share, from 0 to 1. The `label` sits at the left, the
percent at the right, and the `caption` under the bar, lined up with it.
Unset, the tone follows how full the bar is: `warning` from 80 %,
`danger` from 90 %. The percent keeps a decimal under 10 %, and none at 0.

**Named shares**

```tsx
import { Meter } from '@bh/ui';

export function NamedShares() {
  return (
    <div className="flex w-360 flex-col gap-16">
      <Meter
        label="CPU"
        fraction={0.23}
        caption={
          <>
            load <span className="text-gray-12 font-mono tabular-nums">1.20 · 0.94 · 0.71</span>{' '}
            over 1, 5 and 15 min
          </>
        }
      />
      <Meter
        label="Memory"
        fraction={0.84}
        caption={
          <>
            <span className="text-gray-12 font-mono tabular-nums">13.4 GB</span> used of{' '}
            <span className="text-gray-12 font-mono tabular-nums">16 GB</span>
          </>
        }
      />
      <Meter label="Disk" fraction={0.93} caption="Past 90 %, the bar turns red." />
    </div>
  );
}
```

`tone` sets the fill's tone instead, for a share whose thresholds are its
own. `marks` draw those thresholds as hairlines on the bar, each with its
`label` as a tooltip. Write them in the caption as well: a hairline is not
a number. `showLabel={false}` keeps the label as the bar's name only, for
a card whose title already says what the bar is.

**Marks and a tone**

```tsx
import { Meter } from '@bh/ui';

export function MarksAndATone() {
  return (
    <div className="w-360">
      <Meter
        label="Disk used"
        showLabel={false}
        fraction={0.71}
        tone="primary"
        marks={[
          { at: 0.85, label: 'Alert line, 300 GB free' },
          { at: 0.95, label: 'Floor, 100 GB free' },
        ]}
        caption="1.1 TB free of 2 TB · alert at 300 GB · floor at 100 GB"
      />
    </div>
  );
}
```

`meterTone(fraction)` is the tone a Meter takes by itself, for something
else that shows the same share, a dot or a pill, to agree with its bar.

## Keyboard and accessibility

The bar is a `meter` named by `label`, with `aria-valuemin` 0,
`aria-valuemax` 100, `aria-valuenow` the clamped percent and
`aria-valuetext` the percent as it is written. The marks are hidden from
a screen reader, which is why the caption says them too.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default | Description                                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `label` (required)    | `string`                                                                                                                                                                                                    |         | What the bar measures. Drawn at its left, and its name for a screen reader.                                                      |
| `fraction` (required) | `number`                                                                                                                                                                                                    |         | The share, 0 to 1. One out of range is clamped, and one that is not a number is 0.                                               |
| `caption`             | `ReactNode`                                                                                                                                                                                                 |         | A line under the bar saying what it counts: "6.1 GB used of 16 GB".                                                              |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |         | The fill's tone. Unset, it is `meterTone(fraction)`: warning from 80 %, danger from 90 %.                                        |
| `marks`               | `readonly MeterMark[]`                                                                                                                                                                                      | `[]`    | Thresholds drawn as hairlines on the bar.                                                                                        |
| `showLabel`           | `boolean`                                                                                                                                                                                                   | `true`  | Draws the label at the bar's left. `false` keeps it as the bar's name only, for a card whose title already says what the bar is. |

```ts
interface MeterMark
```

A threshold drawn on a Meter's bar.

| Member             | Type     | Default | Description                                                                               |
| ------------------ | -------- | ------- | ----------------------------------------------------------------------------------------- |
| `at` (required)    | `number` |         | Where it sits, 0 to 1 along the bar from its left end.                                    |
| `label` (required) | `string` |         | What it is, as the mark's tooltip. Say it in the caption too: a hairline is not a number. |

```ts
meterTone(fraction: number): Tone
```

The tone a Meter takes for a share when it is given none: `warning` from
0.8, `danger` from 0.9, `primary` under.

Exported so what else shows the same share (a dot in the nav, a pill) takes
the same tone as its bar.

| Parameter             | Type     | Default | Description        |
| --------------------- | -------- | ------- | ------------------ |
| `fraction` (required) | `number` |         | The share, 0 to 1. |

Returns `Tone`.
