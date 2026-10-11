---
title: RangeSlider
summary: Picks a span of numbers with two thumbs, a low end and a high one.
related: [Slider, DateRangePicker, NumberInput]
---

[//]: # 'written from range-slider.doc.yaml by pnpm docs:sync; edit that file, not this one'

# RangeSlider

Picks a span of numbers with two thumbs, a low end and a high one.

`value` is `[low, high]`, and the ends never swap: an end moved past the
other stops where the other is.

## Import

```tsx
import { RangeSlider } from '@bh/ui';
```

## Examples

Only the span between the thumbs is filled. A press on the track moves
whichever end is nearer, and dragging carries it on.

**Picking a span**

```tsx
import { useState } from 'react';
import { RangeSlider } from '@bh/ui';

export function PickingASpan() {
  const [points, setPoints] = useState<[number, number]>([2, 5]);
  return (
    <div className="w-320">
      <RangeSlider label="Points" min={0} max={10} value={points} onChange={setPoints} />
    </div>
  );
}
```

`step` is the grid both ends snap to, counted from `min`, as on
[Slider](../slider/slider.md). The slider shows no numbers, so show
them beside it.

**Steps**

```tsx
import { useState } from 'react';
import { RangeSlider } from '@bh/ui';

export function Steps() {
  const [price, setPrice] = useState<[number, number]>([100, 300]);
  return (
    <div className="flex w-320 flex-col gap-8">
      <RangeSlider label="Price" min={0} max={500} step={25} value={price} onChange={setPrice} />
      <span className="text-12 text-gray-11 font-mono">
        {price[0]} to {price[1]}
      </span>
    </div>
  );
}
```

The ends can meet on one value. Each thumb is its own tab stop, so either
can be moved off it with the arrow keys, and the thumb being held or
focused is drawn on top. A press on the track above the meeting point
moves the high end, and one below it the low end.

**Closed range**

```tsx
import { useState } from 'react';
import { RangeSlider } from '@bh/ui';

export function ClosedRange() {
  const [points, setPoints] = useState<[number, number]>([3, 3]);
  return (
    <div className="w-320">
      <RangeSlider label="Points" min={0} max={10} value={points} onChange={setPoints} />
    </div>
  );
}
```

`size` sets the track, 4, 6 or 8 pixels thick, and the thumbs, 14, 16 or
20 pixels across, as on [Slider](../slider/slider.md).

**Sizes**

```tsx
import { useState } from 'react';
import { RangeSlider } from '@bh/ui';

export function Sizes() {
  const [points, setPoints] = useState<[number, number]>([2, 5]);
  return (
    <div className="flex w-320 flex-col gap-16">
      <RangeSlider label="Small" size="xs" min={0} max={10} value={points} onChange={setPoints} />
      <RangeSlider label="Medium" size="md" min={0} max={10} value={points} onChange={setPoints} />
      <RangeSlider label="Large" size="lg" min={0} max={10} value={points} onChange={setPoints} />
    </div>
  );
}
```

`disabled` takes both thumbs out of the tab order. `readOnly` keeps both
tab stops and ignores the pointer and the keys.

**Disabled and read only**

```tsx
import { useState } from 'react';
import { RangeSlider } from '@bh/ui';

export function DisabledAndReadOnly() {
  const [weekdays, setWeekdays] = useState<[number, number]>([9, 17]);
  const [weekends, setWeekends] = useState<[number, number]>([10, 14]);
  return (
    <div className="flex w-320 flex-col gap-16">
      <RangeSlider
        label="Weekdays"
        disabled
        min={0}
        max={24}
        value={weekdays}
        onChange={setWeekdays}
      />
      <RangeSlider
        label="Weekends"
        readOnly
        min={0}
        max={24}
        value={weekends}
        onChange={setWeekends}
      />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                    | Does                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `→` or `↑`             | Moves the focused end one step up.                                     |
| `←` or `↓`             | Moves the focused end one step down.                                   |
| `Shift+→` or `Shift+↑` | Moves the focused end ten steps up.                                    |
| `Shift+←` or `Shift+↓` | Moves the focused end ten steps down.                                  |
| `Home`                 | Moves the focused end as low as it goes, to `min` or to the low end.   |
| `End`                  | Moves the focused end as high as it goes, to `max` or to the high end. |

Each thumb has `role="slider"` and a name made from `label`:
`label="Price"` gives "Price lower bound" and "Price upper bound". Each
sets its own range: the low thumb's `aria-valuemax` is the high end, and
the high thumb's `aria-valuemin` is the low end. `disabled` sets
`aria-disabled` on both, `readOnly` sets `aria-readonly`.

`id` goes on the wrapper, not on a thumb, so a `<label for>` cannot name
it: `label` does.

## When not to use it

For one number, use [Slider](../slider/slider.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required)    | `[number, number]`                                                                                                                                                                                          |             | The two ends, low then high.                                                                                                                                                  |
| `onChange` (required) | `(value: [number, number]) => void`                                                                                                                                                                         |             | The new pair, low then high: an end moved past the other stops there.                                                                                                         |
| `min`                 | `number`                                                                                                                                                                                                    | `0`         | The lowest value, at the start of the track.                                                                                                                                  |
| `max`                 | `number`                                                                                                                                                                                                    | `100`       | The highest value, at the end of the track.                                                                                                                                   |
| `step`                | `number`                                                                                                                                                                                                    | `1`         | The grid both ends snap to, counted from `min`.                                                                                                                               |
| `label` (required)    | `string`                                                                                                                                                                                                    |             | Accessible name. Each thumb gets its own derived from this.                                                                                                                   |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   | `false`     | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   | `false`     | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                           |
