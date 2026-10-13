---
title: Textarea
summary: Several lines of text, held by the caller.
related: [Input, FieldLabel, FieldError]
---

[//]: # 'written from textarea.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Textarea

Several lines of text.

Like [Input](../input/input.md), it holds no value of its own:
`onChange` hands back the new string, so `onChange={setNotes}` is the whole
handler. With `commit`, what you type is a draft it holds until the field
commits. `size` sets a minimum height, not a fixed one.

## Import

```tsx
import { Textarea } from '@bh/ui';
```

## Examples

Name it with a `<label htmlFor>` pointing at its `id`, or with
`aria-label`.

**With a label**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, Textarea } from '@bh/ui';

export function WithALabel() {
  const id = useId();
  const [notes, setNotes] = useState('');
  return (
    <div className="flex w-288 flex-col gap-4">
      <FieldLabel htmlFor={id}>Notes</FieldLabel>
      <Textarea id={id} value={notes} onChange={setNotes} placeholder="Anything to add" />
    </div>
  );
}
```

`size` sets the minimum height, the padding and the type together: at
least 56, 72 and 88 pixels tall.

**Sizes**

```tsx
import { useState } from 'react';
import { Textarea } from '@bh/ui';

export function Sizes() {
  const [notes, setNotes] = useState('Pack a coat and an umbrella.');
  return (
    <div className="flex w-288 flex-col gap-8">
      <Textarea size="xs" aria-label="Notes, extra small" value={notes} onChange={setNotes} />
      <Textarea size="md" aria-label="Notes, medium" value={notes} onChange={setNotes} />
      <Textarea size="lg" aria-label="Notes, large" value={notes} onChange={setNotes} />
    </div>
  );
}
```

Every `<textarea>` attribute passes through: `rows` starts it taller,
`maxLength` caps it. While it is editable, a grip at the corner drags it
taller.

**More rows**

```tsx
import { useState } from 'react';
import { Textarea } from '@bh/ui';

export function MoreRows() {
  const [message, setMessage] = useState('');
  return (
    <div className="w-288">
      <Textarea
        aria-label="Message"
        placeholder="Write a message"
        value={message}
        onChange={setMessage}
        rows={6}
        maxLength={500}
      />
    </div>
  );
}
```

A field in error takes `tone="danger"`, which colours it and sets
`aria-invalid`. Point `aria-describedby` at the message.
[Tones](../../../../../docs/foundations/tones.md#danger-on-a-field) has what the other tones do.

**With an error**

```tsx
import { useId, useState } from 'react';
import { FieldError, FieldLabel, Textarea } from '@bh/ui';

export function WithAnError() {
  const id = useId();
  const [notes, setNotes] = useState('');
  const invalid = notes.trim() === '';
  return (
    <div className="flex w-288 flex-col gap-4">
      <FieldLabel htmlFor={id} required>
        Notes
      </FieldLabel>
      <Textarea
        id={id}
        value={notes}
        onChange={setNotes}
        tone={invalid ? 'danger' : undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
      />
      {invalid ? <FieldError id={`${id}-error`}>Add a note.</FieldError> : null}
    </div>
  );
}
```

`readOnly` keeps the field focusable and submitted with a form, and swaps
its fill for a line under the text. `disabled` takes it out of the tab
order and the submission, and fades it. Neither keeps the resize grip.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { Textarea } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [notes, setNotes] = useState('Pack a coat and an umbrella.');
  return (
    <div className="flex w-288 flex-col gap-8">
      <Textarea aria-label="Notes, read-only" value={notes} onChange={setNotes} readOnly />
      <Textarea aria-label="Notes, disabled" value={notes} onChange={setNotes} disabled />
    </div>
  );
}
```

`commit` says when `onChange` gets what you typed, as on
[Input](../input/input.md#when-it-commits), but Enter stays a new
line: `'leave'` commits on leaving the field or the window, and on
Ctrl+Enter (Cmd+Enter on a Mac). Escape puts the value back.

**Notes saved on leaving**

```tsx
import { useState } from 'react';
import { Textarea } from '@bh/ui';

export function NotesSavedOnLeaving() {
  const [notes, setNotes] = useState('Bring the floor plans.');
  const [saves, setSaves] = useState(0);
  return (
    <div className="flex w-320 flex-col gap-6">
      <Textarea
        aria-label="Notes"
        value={notes}
        commit="leave"
        onChange={(next) => {
          setNotes(next);
          setSaves((count) => count + 1);
        }}
      />
      <p className="text-12/17 text-gray-11 font-sans">
        Saved {saves} {saves === 1 ? 'time' : 'times'}. Enter is a new line; Ctrl+Enter saves.
      </p>
    </div>
  );
}
```

## Keyboard and accessibility

It is a native `<textarea>`, so typing, Enter for a new line and Tab are
the browser's. The ref lands on the `<textarea>`. `readOnly` is HTML's
`readonly`, not `aria-readonly`.

| Key                         | Does                                                                |
| --------------------------- | ------------------------------------------------------------------- |
| `Ctrl+Enter` or `Cmd+Enter` | Commits the draft, when the field holds one.                        |
| `Escape`                    | Drops the draft, when the field holds one, and puts the value back. |

## When not to use it

For one line, use [Input](../input/input.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default    | Description                                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | `string`                                                                                                                                                                                                    |            | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                                                           |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |            | Identifies the element (or elements) that describes the object. The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws. |
| `value` (required)    | `string`                                                                                                                                                                                                    |            | The value shown. The control holds none of its own: it reports changes through `onChange`.                                                                                                                                                    |
| `onChange` (required) | `(value: string, event?: SyntheticEvent) => void`                                                                                                                                                           |            | The new value — and, second, the event that produced it where one exists.                                                                                                                                                                     |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`     | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                                                         |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |            | The role or scale it is coloured from.                                                                                                                                                                                                        |
| `disabled`            | `boolean`                                                                                                                                                                                                   |            | Not applicable: removed from the tab order and from form submission.                                                                                                                                                                          |
| `readOnly`            | `boolean`                                                                                                                                                                                                   |            | Not editable, but still focusable and still submitted.                                                                                                                                                                                        |
| `className`           | `string`                                                                                                                                                                                                    |            | Added to the control's own classes.                                                                                                                                                                                                           |
| `commit`              | `Commit`                                                                                                                                                                                                    | `'change'` | When `onChange` gets what you typed: `'change'` at every keystroke; `'leave'` on Enter and on leaving the field or the window; `{ after: 800 }` on those and after 800 ms without typing.                                                     |
| `onDraft`             | `(draft: string) => void`                                                                                                                                                                                   |            | What's in the field, at every keystroke, before it commits: for a count, a preview, or a button that waits for some text. At `'change'` it's what `onChange` gets.                                                                            |
| `ref`                 | `Ref<HTMLTextAreaElement>`                                                                                                                                                                                  |            | Forwarded to the `<textarea>`.                                                                                                                                                                                                                |

Also every `<textarea>` attribute (`TextareaHTMLAttributes<HTMLTextAreaElement>`), passed through.
