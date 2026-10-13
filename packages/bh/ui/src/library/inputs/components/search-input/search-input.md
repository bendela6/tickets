---
title: SearchInput
summary: A search field, with a clear button once there is something to clear.
related: [Input, Combobox]
---

[//]: # 'written from search-input.doc.yaml by pnpm docs:sync; edit that file, not this one'

# SearchInput

A search field, with a clear button once there is something to clear.

The slot after the text shows one thing at a time: a spinner while
`loading`; otherwise the clear button, once there is a value; otherwise the
`shortcut` hint.

## Import

```tsx
import { SearchInput } from '@bh/ui';
```

## Examples

While the field is empty it shows `shortcut`. Type, and the hint gives way
to the clear button, which sets the value to `''`. The hint is only
drawn: binding the key is yours.

**Shortcut and clear**

```tsx
import { useState } from 'react';
import { SearchInput } from '@bh/ui';

export function ShortcutAndClear() {
  const [query, setQuery] = useState('');
  return (
    <div className="w-256">
      <SearchInput aria-label="Search files" value={query} onChange={setQuery} shortcut="⌘K" />
    </div>
  );
}
```

`loading` puts a spinner in the slot, in place of the clear button or the
hint.

**Loading**

```tsx
import { useState } from 'react';
import { SearchInput } from '@bh/ui';

export function Loading() {
  const [query, setQuery] = useState('report.pdf');
  return (
    <div className="w-256">
      <SearchInput aria-label="Search files" value={query} onChange={setQuery} loading />
    </div>
  );
}
```

`commit` and `onDraft` are [Input](../input/input.md#when-it-commits)'s.
`{ after: 300 }` searches once the typing pauses, rather than at every
keystroke; the clear button answers to what's in the field.

**Search after a pause**

```tsx
import { useState } from 'react';
import { SearchInput } from '@bh/ui';

const CITIES = ['Lisbon', 'Lima', 'Lyon', 'Tbilisi', 'Tallinn', 'Turin'];

export function SearchAfterAPause() {
  const [query, setQuery] = useState('');
  const [searches, setSearches] = useState(0);
  const found = CITIES.filter((city) => city.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex w-256 flex-col gap-8">
      <SearchInput
        aria-label="Search cities"
        value={query}
        commit={{ after: 300 }}
        onChange={(next) => {
          setQuery(next);
          setSearches((count) => count + 1);
        }}
      />
      <p className="text-12/17 text-gray-11 font-sans">
        {found.length > 0 ? found.join(', ') : 'No city'} ({searches}{' '}
        {searches === 1 ? 'search' : 'searches'})
      </p>
    </div>
  );
}
```

`size` is [Input](../input/input.md)'s: 30, 38 and 46 pixels.

**Sizes**

```tsx
import { useState } from 'react';
import { SearchInput } from '@bh/ui';

export function Sizes() {
  const [query, setQuery] = useState('');
  return (
    <div className="flex w-256 flex-col gap-8">
      <SearchInput size="xs" aria-label="Search, extra small" value={query} onChange={setQuery} />
      <SearchInput size="md" aria-label="Search, medium" value={query} onChange={setQuery} />
      <SearchInput size="lg" aria-label="Search, large" value={query} onChange={setQuery} />
    </div>
  );
}
```

Neither a read-only nor a disabled search can be cleared: the clear button
is disabled in both.

**Read only and disabled**

```tsx
import { useState } from 'react';
import { SearchInput } from '@bh/ui';

export function ReadOnlyAndDisabled() {
  const [query, setQuery] = useState('report.pdf');
  return (
    <div className="flex w-256 flex-col gap-8">
      <SearchInput aria-label="Search, read-only" value={query} onChange={setQuery} readOnly />
      <SearchInput aria-label="Search, disabled" value={query} onChange={setQuery} disabled />
    </div>
  );
}
```

## Keyboard and accessibility

| Key   | Does                                                            |
| ----- | --------------------------------------------------------------- |
| `Tab` | Moves on to the next field. The clear button is not a tab stop. |

It is an `<input type="search">`, so its role is `searchbox`; name it with
`aria-label` or a `<label htmlFor>`. The placeholder, `Search…` unless you
give one, is not a name.

The search glyph is hidden from screen readers. The clear button is named
"Clear search", and the spinner is an image named "Loading".

## When not to use it

To pick one option from a list, searching it as you type, use
[Combobox](../combobox/combobox.md).

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default | Description                                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loading`             | `boolean`                                                                                                                                                                                                   | `false` | Results are in flight. The trailing gutter carries a spinner.                                                                                                                                                                                 |
| `shortcut`            | `string`                                                                                                                                                                                                    |         | Keyboard hint shown while empty — `⌘K`. Dropped as soon as there is a value, because by then the field is already open and focused.                                                                                                           |
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
