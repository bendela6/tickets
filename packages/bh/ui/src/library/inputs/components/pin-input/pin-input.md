---
title: PinInput
summary: A short code of fixed length, one character to a cell.
related: [PasswordInput, Input]
---

[//]: # 'written from pin-input.doc.yaml by pnpm docs:sync; edit that file, not this one'

# PinInput

A short code of fixed length, one character to a cell.

The cells are one value: `value` is the whole code and `onChange` sends the
whole code. A half-entered code is sent as far as it goes, `429` rather
than `429` and three spaces, so its length says whether it is complete.

## Import

```tsx
import { PinInput } from '@bh/ui';
```

## Examples

Typing a character fills the cell and moves to the next. A paste fills the
cells from the one it lands in and moves to the last it filled, rather than
putting the whole code in one cell.

**A verification code**

```tsx
import { useState } from 'react';
import { PinInput } from '@bh/ui';

export function AVerificationCode() {
  const [code, setCode] = useState('');
  return (
    <div className="flex flex-col gap-8">
      <PinInput label="Verification code" value={code} onChange={setCode} />
      <p className="text-12 text-gray-11 font-mono">value: "{code}"</p>
    </div>
  );
}
```

`length` sets how many cells: six unless you say.

**Four cells**

```tsx
import { useState } from 'react';
import { PinInput } from '@bh/ui';

export function FourCells() {
  const [pin, setPin] = useState('');
  return <PinInput label="PIN" length={4} value={pin} onChange={setPin} />;
}
```

There is no `invalid` prop: a rejected code takes `tone="danger"`, which
colours the cells and marks the group `aria-invalid`. The message is yours
to place.

**A rejected code**

```tsx
import { useState } from 'react';
import { FieldError, PinInput } from '@bh/ui';

export function ARejectedCode() {
  const [code, setCode] = useState('429117');
  const rejected = code === '429117';
  return (
    <div className="flex flex-col gap-4">
      <PinInput
        label="Verification code"
        value={code}
        onChange={setCode}
        tone={rejected ? 'danger' : undefined}
      />
      {rejected ? <FieldError>That code has expired.</FieldError> : null}
    </div>
  );
}
```

`readOnly` keeps the cells focusable and refuses changes, and swaps their
fill for a line under each. `disabled` takes them out of the tab order and
fades them.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { PinInput } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [code, setCode] = useState('429117');
  return (
    <div className="flex flex-col gap-12">
      <PinInput label="Code, read-only" value={code} onChange={setCode} readOnly />
      <PinInput label="Code, disabled" value={code} onChange={setCode} disabled />
    </div>
  );
}
```

## Keyboard and accessibility

| Key                         | Does                                                                     |
| --------------------------- | ------------------------------------------------------------------------ |
| `Backspace`                 | Clears the cell. In an empty cell, steps back and clears the one before. |
| `ArrowLeft` or `ArrowRight` | Moves to the cell before or after, changing nothing.                     |
| `Tab`                       | Moves to the next cell. Each cell is a tab stop.                         |

The cells sit in a `group` named by `label`, "Verification code" unless you
give one, and each cell is named "Character 1 of 6" and so on. The first
cell takes the `id` and `autoComplete="one-time-code"`. Focusing a cell
selects its character, so typing replaces it.

The cells ask a phone for a number pad (`inputMode="numeric"`), but take
any character.

## When not to use it

For a secret of any length, use [PasswordInput](../password-input/password-input.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default               | Description                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `length`              | `number`                                                                                                                                                                                                    | `6`                   | How many cells. Six unless the code says otherwise.                                                                                                                           |
| `label`               | `string`                                                                                                                                                                                                    | `'Verification code'` | Accessible name for the group of cells.                                                                                                                                       |
| `id`                  | `string`                                                                                                                                                                                                    |                       | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |                       | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `string`                                                                                                                                                                                                    |                       | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                    |
| `onChange` (required) | `(value: string, event?: SyntheticEvent) => void`                                                                                                                                                           |                       | The new value — and, second, the event that produced it where one exists.                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`                | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |                       | The role or scale it is coloured from.                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   |                       | Not applicable: removed from the tab order and from form submission.                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |                       | Not editable, but still focusable and still submitted.                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |                       | Added to the control's own classes.                                                                                                                                           |
