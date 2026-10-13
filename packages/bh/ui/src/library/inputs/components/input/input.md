---
title: Input
summary: A single line of text, held by the caller.
related: [Textarea, SearchInput, PasswordInput, NumberInput]
---

[//]: # 'written from input.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Input

A single line of text.

It holds no value of its own: `value` comes in, and `onChange` hands back
the new string, not the event, so `onChange={setName}` is the whole
handler. The event follows as a second argument, for the rare handler that
reads it. With [`commit`](#when-it-commits), what you type is a draft it
holds until the field commits.

## Import

```tsx
import { Input } from '@bh/ui';
```

## Examples

Name a field with a `<label htmlFor>` pointing at its `id`, or with
`aria-label`.

**With a label**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, Input } from '@bh/ui';

export function WithALabel() {
  const id = useId();
  const [name, setName] = useState('');
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Name</FieldLabel>
      <Input id={id} value={name} onChange={setName} placeholder="Your name" />
    </div>
  );
}
```

`size` sets the height, padding, radius and type together: 30, 38 and 46
pixels.

**Sizes**

```tsx
import { useState } from 'react';
import { Input } from '@bh/ui';

export function Sizes() {
  const [city, setCity] = useState('Lisbon');
  return (
    <div className="flex w-256 flex-col gap-8">
      <Input size="xs" aria-label="City, extra small" value={city} onChange={setCity} />
      <Input size="md" aria-label="City, medium" value={city} onChange={setCity} />
      <Input size="lg" aria-label="City, large" value={city} onChange={setCity} />
    </div>
  );
}
```

`leading` and `trailing` pin content inside the field, before and after the
text: an icon, a unit, a domain. The border draws around them.

**Leading and trailing**

```tsx
import { useState } from 'react';
import { Icon, Input } from '@bh/ui';

export function LeadingAndTrailing() {
  const [site, setSite] = useState('');
  const [user, setUser] = useState('');
  return (
    <div className="flex w-256 flex-col gap-8">
      <Input
        aria-label="Website"
        placeholder="Website"
        value={site}
        onChange={setSite}
        leading={<Icon name="link" size="sm" className="text-gray-9" />}
      />
      <Input
        aria-label="Username"
        placeholder="Username"
        value={user}
        onChange={setUser}
        trailing={<span className="text-12 text-gray-9">@example.com</span>}
      />
    </div>
  );
}
```

`showCount` draws how many characters there are against `maxLength`. It
needs `maxLength`: without it there is no count.

**Character count**

```tsx
import { useState } from 'react';
import { Input } from '@bh/ui';

export function CharacterCount() {
  const [title, setTitle] = useState('Summer in the mountains');
  return (
    <div className="w-256">
      <Input aria-label="Title" value={title} onChange={setTitle} maxLength={40} showCount />
    </div>
  );
}
```

There is no `invalid` prop: a field in error takes `tone="danger"`, which
colours it and sets `aria-invalid`. Point `aria-describedby` at the message.
[Tones](../../../../../docs/foundations/tones.md#danger-on-a-field) has what the other tones do.

**With an error**

```tsx
import { useId, useState } from 'react';
import { FieldError, FieldLabel, Input } from '@bh/ui';

export function WithAnError() {
  const id = useId();
  const [email, setEmail] = useState('name@');
  const invalid = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <div className="flex w-256 flex-col gap-4">
      <FieldLabel htmlFor={id}>Email</FieldLabel>
      <Input
        id={id}
        value={email}
        onChange={setEmail}
        tone={invalid ? 'danger' : undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
      />
      {invalid ? <FieldError id={`${id}-error`}>Enter a whole email address.</FieldError> : null}
    </div>
  );
}
```

`readOnly` keeps the field focusable and submitted with a form, and swaps
its fill for a line under the value. `disabled` takes it out of the tab
order and the submission, and fades it.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { Input } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [city, setCity] = useState('Lisbon');
  return (
    <div className="flex w-256 flex-col gap-8">
      <Input aria-label="City, read-only" value={city} onChange={setCity} readOnly />
      <Input aria-label="City, disabled" value={city} onChange={setCity} disabled />
    </div>
  );
}
```

## When it commits

By default `onChange` gets every keystroke. A field that saves its value,
to a server or to a form that sends each change, wants it once, when the
reader is done with it. `commit` says when:

- `'change'`, the default: at every keystroke.
- `'leave'`: on Enter, and on leaving the field or the window.
- `{ after: 800 }`: on those, and after 800 ms without typing.

Until then, what you type is a draft the field holds, and `onDraft` hears
it at every keystroke. Escape puts the value back. A draft that ends where
it started commits nothing. A `value` that changes while nobody is typing,
an edit made elsewhere, replaces the field without remounting it; while
somebody is typing, their draft stays. A draft still waiting for its pause
commits at once when they leave or the field unmounts, so nothing typed is
lost.

A field that saves when you leave it. Under it, the draft and what's
saved: type, then press Enter, Tab away, or Escape.

**A field saved on leaving**

```tsx
import { useId, useState } from 'react';
import { FieldLabel, Input } from '@bh/ui';

export function AFieldSavedOnLeaving() {
  const id = useId();
  const [city, setCity] = useState('Lisbon');
  const [draft, setDraft] = useState(city);
  const [saves, setSaves] = useState(0);
  return (
    <div className="flex w-256 flex-col gap-8">
      <div className="flex flex-col gap-4">
        <FieldLabel htmlFor={id}>City</FieldLabel>
        <Input
          id={id}
          value={city}
          commit="leave"
          onDraft={setDraft}
          onChange={(next) => {
            setCity(next);
            setSaves((count) => count + 1);
          }}
        />
      </div>
      <p className="text-12/17 text-gray-11 font-sans">
        Draft <span className="text-gray-12 font-mono">{draft}</span>
      </p>
      <p className="text-12/17 text-gray-11 font-sans">
        Saved <span className="text-gray-12 font-mono">{city}</span>, {saves}{' '}
        {saves === 1 ? 'time' : 'times'}
      </p>
    </div>
  );
}
```

A title that saves after a pause in typing, as a document's does.

**A title saved after a pause**

```tsx
import { useState } from 'react';
import { Input } from '@bh/ui';

export function ATitleSavedAfterAPause() {
  const [title, setTitle] = useState('Quarterly review');
  const [saves, setSaves] = useState(0);
  return (
    <div className="flex w-320 flex-col gap-6">
      <Input
        aria-label="Title"
        size="lg"
        value={title}
        commit={{ after: 800 }}
        onChange={(next) => {
          setTitle(next);
          setSaves((count) => count + 1);
        }}
      />
      <p className="text-12/17 text-gray-11 font-sans">
        {saves === 0
          ? 'Saves 800 ms after you stop typing.'
          : `Saved “${title}”, ${saves} ${saves === 1 ? 'time' : 'times'}`}
      </p>
    </div>
  );
}
```

A "+ add" input keeps its `value` at `''`: each commit adds a task, and
after it the field shows `value` again, empty. `onDraft` shows the Enter
hint only while there's something to add.

**An add input**

```tsx
import { useState } from 'react';
import { cn, Input } from '@bh/ui';

export function AnAddInput() {
  const [tasks, setTasks] = useState(['Book the room', 'Send the agenda']);
  const [typing, setTyping] = useState(false);
  return (
    <div className="flex w-256 flex-col gap-8">
      <ul className="text-13/19 text-gray-12 flex flex-col gap-4 font-sans">
        {tasks.map((task, index) => {
          return <li key={`${index}-${task}`}>{task}</li>;
        })}
      </ul>
      <Input
        aria-label="New task"
        placeholder="+ Add a task"
        // Always empty: each commit adds a task, and the field shows this again.
        value=""
        commit="leave"
        onDraft={(draft) => setTyping(draft.trim() !== '')}
        onChange={(next) => {
          const task = next.trim();
          if (task !== '') {
            setTasks((current) => [...current, task]);
          }
          setTyping(false);
        }}
        trailing={
          <kbd className={cn('text-11 text-gray-9 shrink-0 font-mono', !typing && 'invisible')}>
            Enter
          </kbd>
        }
      />
    </div>
  );
}
```

## Keyboard and accessibility

It is a native `<input>`, so typing, selecting and Tab are the browser's.
The ref lands on the `<input>`, with or without `leading` and `trailing`.
With `commit` other than `'change'`, Enter commits the draft (and still
submits a form around it) and Escape puts the value back; an Escape with
nothing to put back reaches a dialog around the field.

`readOnly` is HTML's `readonly`, not `aria-readonly`. The count from
`showCount` is `aria-hidden`. An `Icon` given as `leading` or `trailing`
with no `label` is hidden from screen readers too.

## When not to use it

- For several lines, use [Textarea](../textarea/textarea.md).
- For a number, use [NumberInput](../number-input/number-input.md), which
  steps and holds `null` when empty.
- For a secret, use [PasswordInput](../password-input/password-input.md); for
  a search, [SearchInput](../search-input/search-input.md).
- To pick from a known list, use [Combobox](../combobox/combobox.md),
  with search or [without](../combobox/combobox.md#without-search).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default    | Description                                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leading`             | `ReactNode`                                                                                                                                                                                                 |            | Content pinned inside the field, before the text — an icon, a currency mark.                                                                                                                                                                  |
| `trailing`            | `ReactNode`                                                                                                                                                                                                 |            | Content pinned inside the field, after the text — a unit, a shortcut hint, a clear button.                                                                                                                                                    |
| `showCount`           | `boolean`                                                                                                                                                                                                   |            | Draw a `62/80` count in the trailing gutter. Requires the native `maxLength`, because a count with no ceiling is a number nobody can act on — how many you have typed only matters against how many you may.                                  |
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
| `ref`                 | `Ref<HTMLInputElement>`                                                                                                                                                                                     |            | Forwarded to the `<input>`.                                                                                                                                                                                                                   |

Also every `<input>` attribute (`InputHTMLAttributes<HTMLInputElement>`), passed through.
