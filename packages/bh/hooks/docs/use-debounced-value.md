---
title: useDebouncedValue
summary: A value that follows another once it has stopped changing for a delay,
  as a search follows its field once the typing stops.
order: 3
related: [Writing a hook, useDebouncedCallback]
---

[//]: # 'written from use-debounced-value.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useDebouncedValue

A value that follows another once it has stopped changing for a
delay: a search that follows its field once the typing stops, rather
than on every key. What is done with it is the caller's.

## Import

```tsx
import { useDebouncedValue } from '@bh/hooks';
```

## Examples

**Searched once the typing stops**

```tsx
import { useState } from 'react';
import { useDebouncedValue } from '@bh/hooks';

// A field and what it searches for: the search follows the text once the
// typing has stopped for 400 milliseconds. A plain input, no component of bh's.

const FRUIT = ['Apple', 'Apricot', 'Banana', 'Blackberry', 'Cherry', 'Grape', 'Lemon', 'Mango'];

export function SearchedOnceTheTypingStops() {
  const [text, setText] = useState('');
  const query = useDebouncedValue(text.trim().toLowerCase(), { delay: 400 });
  const found = FRUIT.filter((fruit) => fruit.toLowerCase().includes(query));
  return (
    <div className="flex w-280 flex-col gap-8">
      <input
        aria-label="Search fruit"
        placeholder="Search fruit"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="border-gray-6 rounded-6 border-1 px-8 py-4"
      />
      <span className="text-12/17 text-gray-10">
        {query === text.trim().toLowerCase() ? `Searched for “${query}”` : 'Typing…'}
      </span>
      <ul className="text-13/19 text-gray-11">
        {found.map((fruit) => {
          return <li key={fruit}>{fruit}</li>;
        })}
      </ul>
    </div>
  );
}
```

Type in the field: the list follows the text 400 milliseconds after
the last key, and the line under the field says whether it has caught
up. The value goes first and the options after it, as a hook about one
value takes them: `useDebouncedValue(text, { delay: 400 })`.

It returns the value alone, as React's `useDeferredValue` does: it is
behind while it differs from what it follows. To act on each settled
value, a request sent once the typing stops, list it as an effect's
dependency, or call [useDebouncedCallback](use-debounced-callback.md)
from the field's `onChange` instead.

## Rules

- **It starts at the value**, on its first render and on a server, so
  a page drawn with a query already in its field searches for it at
  once.
- **Each change starts the wait again**, so pass a value that is the
  same while it means the same: a string or a number, or an object
  kept outside the render. An object made new on each render never
  settles.
- **A new `delay`** starts the wait again too.
- **Cleaning up**: its one timer goes with each change and with the
  component.

## Reference

```ts
useDebouncedValue<T>(value: T, options: UseDebouncedValueOptions): T
```

A value that follows `value` once it has stopped changing for `delay`
milliseconds: a search box's text, sent once the typing stops. It starts
at `value`, which is its server value too.

Each change starts the wait again, so pass a value that is the same while
it means the same: a string or a number, or an object kept outside the
render.

| Parameter                  | Type                       | Default | Description                                                                     |
| -------------------------- | -------------------------- | ------- | ------------------------------------------------------------------------------- |
| `value` (required)         | `T`                        |         | What to follow.                                                                 |
| `options` (required)       | `UseDebouncedValueOptions` |         |                                                                                 |
| `options.delay` (required) | `number`                   |         | How long the value must stay the same, in milliseconds, before it is handed on. |

Returns `T`: `value` as it was when it last stood still for `delay`.

```ts
interface UseDebouncedValueOptions
```

What `useDebouncedValue` takes after the value.

| Member             | Type     | Default | Description                                                                     |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------- |
| `delay` (required) | `number` |         | How long the value must stay the same, in milliseconds, before it is handed on. |
