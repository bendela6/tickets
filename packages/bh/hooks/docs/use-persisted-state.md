---
title: usePersistedState
summary: useState that remembers, in localStorage under the app's key, and keeps
  every place using the key in step, on the page and across the app's tabs.
order: 3
related: [Writing a hook, The app names its own, Drawer, Widths and resizing]
---

[//]: # 'written from use-persisted-state.doc.yaml by pnpm docs:sync; edit that file, not this one'

# usePersistedState

`useState` that remembers: a value kept in `localStorage` under the
app's key, read back on the next visit, and the same in every place
that uses the key, on the page and in the app's other tabs. What the
value looks like, and what reads it, is the caller's.

`readStored` and `writeStored` are the guarded reads and writes under
it, for code outside a component: a theme applied before the first
render, a draft saved as it changes.

## Import

```tsx
import { readStored, usePersistedState, writeStored } from '@bh/hooks';
```

## Examples

**Two counts one key**

```tsx
import { usePersistedState, writeStored } from '@bh/hooks';

// Two counts under one key, and a button that forgets it: a plain view of
// buttons, with no component of bh's, so what shows is the hook.

const KEY = 'docs:hooks:count';
const BUTTON = 'rounded-8 border-gray-6 border-1 px-12 py-6';

function Count({ name }: { name: string }) {
  const [count, setCount] = usePersistedState({ key: KEY, defaultValue: 0 });
  return (
    <button type="button" className={BUTTON} onClick={() => setCount((before) => before + 1)}>
      {name}: {count}
    </button>
  );
}

export function TwoCountsOneKey() {
  return (
    <div className="flex flex-col items-start gap-8">
      <div className="flex gap-8">
        <Count name="Left" />
        <Count name="Right" />
      </div>
      <button type="button" className={BUTTON} onClick={() => writeStored(KEY, null)}>
        Forget it
      </button>
    </div>
  );
}
```

Each button counts its clicks under the one key, `docs:hooks:count`,
so the two move together. Reload the page and they come back where
they were; open this page in a second tab and click there, and this
one follows. **Forget it** takes the key out with `writeStored(KEY,
null)`, and both go back to `defaultValue`.

It returns a pair, as `useState` does, and its setter takes a value or
a function of the one before it:

```ts
import { usePersistedState } from '@bh/hooks';

export function useSidebarOpen() {
  const [open, setOpen] = usePersistedState({ key: 'shop:sidebar', defaultValue: true });
  return { open, toggle: () => setOpen((before) => !before) };
}
```

## Reading what is stored

A value is stored as JSON unless `serialize` says otherwise, and read
back with `parse`, which is where an app checks what an older version
of it stored: return `undefined` for a string it can't read, and the
value is `defaultValue` again. A string that isn't JSON reads the same
way.

```ts
import { usePersistedState } from '@bh/hooks';

const SIZES = ['sm', 'md', 'lg'] as const;
type Size = (typeof SIZES)[number];

// Outside the component, so it is the same function on every render.
function parseSize(raw: string): Size | undefined {
  return SIZES.find((size) => size === raw);
}

export function useDensity() {
  return usePersistedState<Size>({
    key: 'shop:density',
    defaultValue: 'md',
    serialize: (size) => size,
    parse: parseSize,
  });
}
```

## Rules

- **Its server value is `defaultValue`**: a server has no storage, so
  nothing is read there. An app that renders only in the browser reads
  the stored value on its first render, a hydrated page right after it.
- **No key, nothing stored**: `key: undefined` is plain state, which
  lives as long as the component and writes nothing under a name the
  hook made up. A hook can't be called on a condition, so this is how
  a component stores only when the app names it.
- **One key, one value**: every `usePersistedState` on the page under
  the key holds the same value, and so does each one in the app's
  other tabs, through the browser's `storage` event. `writeStored`
  moves them too; a write straight to `localStorage` does not.
- **A storage that refuses** (blocked, or full) reads as empty, and the
  value still changes for the page while anything on it uses the key:
  it is only not remembered.
- **`storage: 'session'`** keeps it in the tab's own `sessionStorage`,
  for as long as the tab is open; another tab has its own.
- **What keeps its identity**: the setter, for the hook's life; the
  value, until it changes, as long as `parse` and an object
  `defaultValue` come from outside the component.
- **Cleaning up**: its `storage` listener goes with the component.

## Reference

```ts
usePersistedState<T>(options: UsePersistedStateOptions<T>): [T, SetPersisted<T>]
```

`useState` that remembers: a value kept in `localStorage` under the app's
key, read back on the next visit. Every component on the page using the
key holds the one value, and so do the app's other open tabs, through the
browser's `storage` event.

Its server value is `defaultValue`: nothing is read until the browser
renders. Pass `parse` and an object `defaultValue` from outside the
component, so the value keeps its identity between renders.

| Parameter                         | Type                               | Default          | Description                                                                                                     |
| --------------------------------- | ---------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `options` (required)              | `UsePersistedStateOptions<T>`      |                  |                                                                                                                 |
| `options.key` (required)          | `string`                           |                  | The app's name for it, as `shop:sidebar`; without one nothing is stored, and it lives as long as the component. |
| `options.defaultValue` (required) | `T`                                |                  | The value while nothing is stored, and on a server.                                                             |
| `options.serialize`               | `(value: T) => string`             | `JSON.stringify` | The string stored for a value. `JSON.stringify` unless given.                                                   |
| `options.parse`                   | `(raw: string) => T \| undefined`  | `JSON.parse`     | A stored string's value, or `undefined` for one it can't read, which reads as unset. `JSON.parse` unless given. |
| `options.storage`                 | `StoredIn`: `'local'`, `'session'` | `'local'`        | `localStorage` unless `session`, which keeps it for the tab alone and only while the tab is open.               |

Returns `[T, SetPersisted<T>]`: The value, and its setter, which keeps one identity for the hook's life.

```ts
interface UsePersistedStateOptions<T>
```

What `usePersistedState` takes.

| Member                    | Type                               | Default | Description                                                                                                     |
| ------------------------- | ---------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `key` (required)          | `string`                           |         | The app's name for it, as `shop:sidebar`; without one nothing is stored, and it lives as long as the component. |
| `defaultValue` (required) | `T`                                |         | The value while nothing is stored, and on a server.                                                             |
| `serialize`               | `(value: T) => string`             |         | The string stored for a value. `JSON.stringify` unless given.                                                   |
| `parse`                   | `(raw: string) => T \| undefined`  |         | A stored string's value, or `undefined` for one it can't read, which reads as unset. `JSON.parse` unless given. |
| `storage`                 | `StoredIn`: `'local'`, `'session'` |         | `localStorage` unless `session`, which keeps it for the tab alone and only while the tab is open.               |

```ts
type SetPersisted<T> = (next: T | ((previous: T) => T)) => void;
```

`usePersistedState`'s setter: a value, or a function of the one before it, as `useState`'s takes.

```ts
readStored(key: string | undefined, storage?: StoredIn): string | null
```

The string stored under `key`, or `null` for none: no key, nothing stored,
or a storage that can't be read.

| Parameter        | Type                  | Default   | Description                                       |
| ---------------- | --------------------- | --------- | ------------------------------------------------- |
| `key` (required) | `string \| undefined` |           | The app's name for it; `undefined` reads nothing. |
| `storage`        | `StoredIn`            | `'local'` | `localStorage` unless `session`.                  |

Returns `string \| null`.

```ts
writeStored(key: string | undefined, raw: string | null, storage?: StoredIn): void
```

Stores `raw` under `key`, or takes the key out for `null`, and every
`usePersistedState` on the page under the key follows. A storage that
refuses it, blocked or full, is let be: the value is not remembered, and
nothing throws.

| Parameter        | Type                  | Default   | Description                                        |
| ---------------- | --------------------- | --------- | -------------------------------------------------- |
| `key` (required) | `string \| undefined` |           | The app's name for it; `undefined` stores nothing. |
| `raw` (required) | `string \| null`      |           | The string to keep, or `null` to forget it.        |
| `storage`        | `StoredIn`            | `'local'` | `localStorage` unless `session`.                   |

Returns `void`.

```ts
type StoredIn = 'local' | 'session';
```

Which of the browser's storages a value is kept in: `localStorage`, or the tab's own `sessionStorage`.

One of `'local'`, `'session'`.
