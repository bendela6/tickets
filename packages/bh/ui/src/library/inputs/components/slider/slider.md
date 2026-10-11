---
title: Slider
summary: Picks one number between a minimum and a maximum.
related: [RangeSlider, NumberInput, Rating]
---

[//]: # 'written from slider.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Slider

Picks one number between a minimum and a maximum.

`label` is required, and it is a prop: the slider is a `div` with
`role="slider"`, and a `<label for>` cannot name a `div`. `value` is
never empty, because the thumb is always drawn somewhere.

## Import

```tsx
import { Slider } from '@bh/ui';
```

## Examples

The slider shows no number of its own, so show it beside the slider. Pass
`valueText` where the number alone would read wrong to a screen reader:
`60%`, not `60`.

**Showing the value**

```tsx
import { useState } from 'react';
import { Slider } from '@bh/ui';

export function ShowingTheValue() {
  const [opacity, setOpacity] = useState(60);
  return (
    <div className="flex w-256 items-center gap-12">
      <Slider label="Opacity" value={opacity} onChange={setOpacity} valueText={`${opacity}%`} />
      <span className="text-12 text-gray-11 w-40 shrink-0 text-right font-mono">{opacity}%</span>
    </div>
  );
}
```

`step` is the grid the value snaps to, counted from `min`: from 20 in
steps of 5, the value lands on 20, 25, 30. With a fractional step, the
value keeps to the step's decimal places.

**Range and step**

```tsx
import { useState } from 'react';
import { Slider } from '@bh/ui';

export function RangeAndStep() {
  const [scale, setScale] = useState(1);
  const [threshold, setThreshold] = useState(35);
  return (
    <div className="flex w-256 flex-col gap-16">
      <div className="flex items-center gap-12">
        <Slider
          label="Scale"
          min={0}
          max={2}
          step={0.1}
          value={scale}
          onChange={setScale}
          valueText={`${scale}×`}
        />
        <span className="text-12 text-gray-11 w-40 shrink-0 text-right font-mono">{scale}×</span>
      </div>
      <div className="flex items-center gap-12">
        <Slider
          label="Threshold"
          min={20}
          max={80}
          step={5}
          value={threshold}
          onChange={setThreshold}
        />
        <span className="text-12 text-gray-11 w-40 shrink-0 text-right font-mono">{threshold}</span>
      </div>
    </div>
  );
}
```

`size` sets the track, 4, 6 or 8 pixels thick, and the thumb, 14, 16 or
20 pixels across.

**Sizes**

```tsx
import { useState } from 'react';
import { Slider } from '@bh/ui';

export function Sizes() {
  const [value, setValue] = useState(40);
  return (
    <div className="flex w-256 flex-col gap-16">
      <Slider label="Small" size="xs" value={value} onChange={setValue} />
      <Slider label="Medium" size="md" value={value} onChange={setValue} />
      <Slider label="Large" size="lg" value={value} onChange={setValue} />
    </div>
  );
}
```

A slider is always painted from a tone, so `tone` defaults to `primary`,
where a bordered field left alone rests in gray. It takes a role or a
scale by name, as [Tones](../../../../../docs/foundations/tones.md) explains.

**Tones**

```tsx
import { useState } from 'react';
import { Slider } from '@bh/ui';

export function Tones() {
  const [red, setRed] = useState(70);
  const [green, setGreen] = useState(45);
  const [blue, setBlue] = useState(20);
  return (
    <div className="flex w-256 flex-col gap-16">
      <Slider label="Red" tone="red" value={red} onChange={setRed} />
      <Slider label="Green" tone="green" value={green} onChange={setGreen} />
      <Slider label="Blue" tone="blue" value={blue} onChange={setBlue} />
    </div>
  );
}
```

`disabled` takes the slider out of the tab order. `readOnly` keeps its tab
stop and its colour, and ignores the pointer and the keys.

**Disabled and read only**

```tsx
import { useState } from 'react';
import { Slider } from '@bh/ui';

export function DisabledAndReadOnly() {
  const [brightness, setBrightness] = useState(30);
  const [contrast, setContrast] = useState(75);
  return (
    <div className="flex w-256 flex-col gap-16">
      <Slider label="Brightness" disabled value={brightness} onChange={setBrightness} />
      <Slider label="Contrast" readOnly value={contrast} onChange={setContrast} />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                    | Does                                                |
| ---------------------- | --------------------------------------------------- |
| `→` or `↑`             | Moves one step up.                                  |
| `←` or `↓`             | Moves one step down.                                |
| `Shift+→` or `Shift+↑` | Moves ten steps up.                                 |
| `Shift+←` or `Shift+↓` | Moves ten steps down.                               |
| `PageUp`               | Moves a tenth of the range up, at least one step.   |
| `PageDown`             | Moves a tenth of the range down, at least one step. |
| `Home`                 | Moves to `min`.                                     |
| `End`                  | Moves to `max`.                                     |

The slider is one tab stop with `role="slider"`, named by `label`. It sets
`aria-valuemin`, `aria-valuemax` and `aria-valuenow`, and `aria-valuetext`
when `valueText` is given. `id` goes on the same element.

A disabled slider sets `aria-disabled`. A read-only one sets
`aria-readonly`, not `aria-disabled`, so a screen reader still reads its
value; the keys it ignores reach the page, so PageDown still scrolls.

## When not to use it

- For a span with two ends, use [RangeSlider](../range-slider/range-slider.md).
- For a number that may be empty, use
  [NumberInput](../number-input/number-input.md): its `value` can be
  `null`.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default     | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `min`                 | `number`                                                                                                                                                                                                    | `0`         | The lowest value, at the start of the track.                                                                                                                                  |
| `max`                 | `number`                                                                                                                                                                                                    | `100`       | The highest value, at the end of the track.                                                                                                                                   |
| `step`                | `number`                                                                                                                                                                                                    | `1`         | The grid the value snaps to, counted from `min`.                                                                                                                              |
| `label` (required)    | `string`                                                                                                                                                                                                    |             | Accessible name. Required — a slider with no name is unusable by voice or screen reader.                                                                                      |
| `valueText`           | `string`                                                                                                                                                                                                    |             | Spoken form of the value where the number alone would mislead — `42%`, `1.5×`.                                                                                                |
| `id`                  | `string`                                                                                                                                                                                                    |             | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |             | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `number`                                                                                                                                                                                                    |             | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                    |
| `onChange` (required) | `(value: number, event?: SyntheticEvent) => void`                                                                                                                                                           |             | The new value — and, second, the event that produced it where one exists.                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`      | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` | `'primary'` | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   | `false`     | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   | `false`     | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |             | Added to the control's own classes.                                                                                                                                           |
