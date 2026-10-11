---
title: Rating
summary: A small fixed scale, picked by clicking one of a row of marks.
related: [Slider, RadioGroup]
---

[//]: # 'written from rating.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Rating

A small fixed scale, picked by clicking one of a row of marks.

Hovering or focusing a mark previews it one step lighter than a chosen
value (step 8 against 9), so a preview can't be taken for a change.

## Import

```tsx
import { Rating } from '@bh/ui';
```

## Examples

`value` is the chosen mark's number, and 0 means unrated. Clicking the
mark already chosen clears the rating back to 0.

**Controlled**

```tsx
import { useState } from 'react';
import { Rating } from '@bh/ui';

export function Controlled() {
  const [value, setValue] = useState(3);
  return <Rating label="Quality" value={value} onChange={setValue} />;
}
```

`showValue` writes the value after the marks, as `4/5`, or `Not rated`
at 0.

**Showing the value**

```tsx
import { useState } from 'react';
import { Rating } from '@bh/ui';

export function ShowingTheValue() {
  const [rated, setRated] = useState(4);
  const [unrated, setUnrated] = useState(0);
  return (
    <div className="flex flex-col gap-12">
      <Rating label="Taste" value={rated} onChange={setRated} showValue />
      <Rating label="Price" value={unrated} onChange={setUnrated} showValue />
    </div>
  );
}
```

`max` sets how many marks there are; it is 5 unless set.

**Scale length**

```tsx
import { useState } from 'react';
import { Rating } from '@bh/ui';

export function ScaleLength() {
  const [three, setThree] = useState(2);
  const [ten, setTen] = useState(7);
  return (
    <div className="flex flex-col gap-12">
      <Rating label="Confidence" max={3} value={three} onChange={setThree} showValue />
      <Rating label="Score" max={10} value={ten} onChange={setTen} showValue />
    </div>
  );
}
```

`size` sets the marks' type size, 12, 13 or 14 pixels, and the space
between them.

**Sizes**

```tsx
import { useState } from 'react';
import { Rating, type ControlSize } from '@bh/ui';

function Sized({ size }: { size: ControlSize }) {
  const [value, setValue] = useState(3);
  return <Rating label={`Quality, ${size}`} size={size} value={value} onChange={setValue} />;
}

export function Sizes() {
  return (
    <div className="flex flex-col gap-12">
      <Sized size="xs" />
      <Sized size="md" />
      <Sized size="lg" />
    </div>
  );
}
```

From the top: editable, read-only and disabled. `readOnly` keeps the
marks in the tab order and ignores clicks; `disabled` takes them out of
it and fades them.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { Rating } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [value, setValue] = useState(3);
  return (
    <div className="flex flex-col gap-12">
      <Rating label="Editable" value={value} onChange={setValue} />
      <Rating label="Read-only" value={value} onChange={setValue} readOnly />
      <Rating label="Disabled" value={value} onChange={setValue} disabled />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                | Does                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------- |
| `Tab`              | Moves from mark to mark, previewing each.                                             |
| `Enter` or `Space` | Sets the rating to the focused mark, or clears it if that mark is already the rating. |

The rating is a `radiogroup`, named by `label` and given the `id`, and
each mark a button with `role="radio"`, named by its place, as "3 of 5".
Only the mark at `value` is `aria-checked`; the star glyphs are hidden
from screen readers. `readOnly` sets `aria-readonly` and ignores the
keys and clicks; `disabled` sets `aria-disabled`.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `max`                 | `number`                                                                                                                                                                                                    | `5`         | How many marks. Five unless a scale says otherwise.                                                                                                                           |
| `label` (required)    | `string`                                                                                                                                                                                                    |             | The group's accessible name.                                                                                                                                                  |
| `showValue`           | `boolean`                                                                                                                                                                                                   | `false`     | Shows the value after the marks, as `3/5`, or `Not rated` at 0.                                                                                                               |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `number`                                                                                                                                                                                                    |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                    |
| `onChange` (required) | `(value: number, event?: SyntheticEvent) => void`                                                                                                                                                           |             | The new value — and, second, the event that produced it where one exists.                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   | `false`     | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   | `false`     | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                           |
