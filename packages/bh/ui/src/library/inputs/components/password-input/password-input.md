---
title: PasswordInput
summary: A secret, with a button that shows it.
related: [Input, PinInput]
---

[//]: # 'written from password-input.doc.yaml by pnpm docs:sync; edit that file, not this one'

# PasswordInput

A secret, with a button that shows it.

The button says `show` or `hide`, a word rather than an eye. Whether the
secret is shown is the field's own state: no prop shows it, so no caller
can show a secret the person did not ask to see.

## Import

```tsx
import { PasswordInput } from '@bh/ui';
```

## Examples

It is an [Input](../input/input.md) whose `type` it sets itself:
`password`, or `text` while shown. Its
[`commit` and `onDraft`](../input/input.md#when-it-commits) are
Input's too.

**Show and hide**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, PasswordInput } from '@bh/ui';

export function ShowAndHide() {
  const id = useId();
  const [password, setPassword] = useState('lemon-tree-42');
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Password</FieldLabel>
      <PasswordInput id={id} value={password} onChange={setPassword} />
    </div>
  );
}
```

`size` is Input's: 30, 38 and 46 pixels.

**Sizes**

```tsx
import { useState } from 'react';
import { PasswordInput } from '@bh/ui';

export function Sizes() {
  const [password, setPassword] = useState('lemon-tree-42');
  return (
    <div className="flex w-256 flex-col gap-8">
      <PasswordInput
        size="xs"
        aria-label="Password, extra small"
        value={password}
        onChange={setPassword}
      />
      <PasswordInput
        size="md"
        aria-label="Password, medium"
        value={password}
        onChange={setPassword}
      />
      <PasswordInput
        size="lg"
        aria-label="Password, large"
        value={password}
        onChange={setPassword}
      />
    </div>
  );
}
```

A read-only secret can still be shown: a value you may not edit may still
need reading. A disabled one cannot, as the button is disabled with the
field.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { PasswordInput } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [password, setPassword] = useState('lemon-tree-42');
  return (
    <div className="flex w-256 flex-col gap-8">
      <PasswordInput
        aria-label="Password, read-only"
        value={password}
        onChange={setPassword}
        readOnly
      />
      <PasswordInput
        aria-label="Password, disabled"
        value={password}
        onChange={setPassword}
        disabled
      />
    </div>
  );
}
```

## Keyboard and accessibility

| Key   | Does                                                      |
| ----- | --------------------------------------------------------- |
| `Tab` | Moves on to the next field. The button is not a tab stop. |

The button is named by its word, `show` or `hide`, and is `aria-pressed`
while the secret is shown. Out of the tab order, it is for the pointer.

## When not to use it

For a short code typed a character to a cell, use [PinInput](../pin-input/pin-input.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default | Description                                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | `string`                                                                                                                                                                                                    |         | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |         | Identifies the element (or elements) that describes the object. The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `string`                                                                                                                                                                                                    |         | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                                                                                    |
| `onChange` (required) | `(value: string, event?: SyntheticEvent) => void`                                                                                                                                                           |         | The new value — and, second, the event that produced it where one exists.                                                                                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       |         | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |         | The role or scale it is coloured from.                                                                                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   |         | Not applicable: removed from the tab order and from form submission.                                                                                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |         | Not editable, but still focusable and still submitted.                                                                                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |         | Added to the control's own classes.                                                                                                                                                                                                           |
| `commit`              | `Commit`                                                                                                                                                                                                    |         | When `onChange` gets what you typed: `'change'` at every keystroke; `'leave'` on Enter and on leaving the field or the window; `{ after: 800 }` on those and after 800 ms without typing.                                                     |
| `onDraft`             | `(draft: string) => void`                                                                                                                                                                                   |         | What's in the field, at every keystroke, before it commits: for a count, a preview, or a button that waits for some text. At `'change'` it's what `onChange` gets.                                                                            |
| `ref`                 | `Ref<HTMLInputElement>`                                                                                                                                                                                     |         | Forwarded to the `<input>`.                                                                                                                                                                                                                   |

Also every `<input>` attribute (`InputHTMLAttributes<HTMLInputElement>`), passed through.
