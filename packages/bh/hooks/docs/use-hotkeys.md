---
title: useHotkeys
summary: Keys that work anywhere on the page, written as Kbd writes them, which
  leave alone a key the reader is typing or the focused control uses.
order: 3
related: [Writing a hook, Kbd, AppShell]
---

[//]: # 'written from use-hotkeys.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useHotkeys

Keys that work anywhere on the page: `mod+k` to search, `/` to find,
`j` and `k` through a list. Each key is written as
[Kbd](../../ui/src/library/primitives/components/kbd/kbd.md) writes it, so the hint drawn and the
key bound are one string. What each key does is the caller's.

## Import

```tsx
import { useHotkeys } from '@bh/hooks';
```

## Examples

**Keys for a list**

```tsx
import { useRef, useState } from 'react';
import { useHotkeys } from '@bh/hooks';

// A list moved through with J and K, a field found with /, and Escape to
// leave it: plain elements, no component of bh's. The keys work anywhere on
// the page while this example is on it, except in a field.

const FRUIT = ['Apple', 'Banana', 'Cherry', 'Grape', 'Lemon'];

export function KeysForAList() {
  const [at, setAt] = useState(0);
  const [last, setLast] = useState('none yet');
  const field = useRef<HTMLInputElement>(null);
  useHotkeys({
    keys: {
      j: () => {
        setAt((before) => Math.min(FRUIT.length - 1, before + 1));
        setLast('J');
      },
      k: () => {
        setAt((before) => Math.max(0, before - 1));
        setLast('K');
      },
      '/': () => {
        field.current?.focus();
        setLast('/');
      },
    },
    repeat: true,
  });
  // A field takes what is typed in it, so Escape there needs whileTyping.
  useHotkeys({
    keys: {
      escape: () => {
        field.current?.blur();
        setLast('Escape');
      },
    },
    whileTyping: true,
  });
  return (
    <div className="flex w-280 flex-col gap-8">
      <input
        ref={field}
        aria-label="Filter"
        placeholder="Press / to type here"
        className="border-gray-6 rounded-6 border-1 px-8 py-4"
      />
      <ul className="text-13/19 flex flex-col">
        {FRUIT.map((fruit, index) => {
          return (
            <li
              key={fruit}
              aria-current={index === at ? 'true' : undefined}
              className="aria-current:bg-indigo-3 aria-current:text-indigo-12 rounded-4 px-8 py-2"
            >
              {fruit}
            </li>
          );
        })}
      </ul>
      <span className="text-12/17 text-gray-10">Last key: {last}</span>
    </div>
  );
}
```

Press **J** and **K** to move through the list, and hold
one: `repeat: true` lets a held key keep moving. **/** puts you
in the field, where J and K are typed as letters, since a key typed in
a field is the field's. **Escape** leaves it: a second
`useHotkeys` with `whileTyping: true` takes it there too.

A key is a chord with `+` between its keys: `mod`, `ctrl`, `alt`,
`shift` and `meta`, then the key itself: a letter, a symbol as it is
typed (`/`, `?`), or a name (`enter`, `escape`, `space`, `up`, `pageup`,
`delete`). `mod` is Command on a Mac and Control elsewhere. A chord
matches only with the modifiers it names, so `mod+z` and
`shift+mod+z` are two keys.

## Rules

- **A key the focused element uses is left to it**: anything typed in
  a field (an input, a textarea, a select, an editable element, a
  textbox, a combobox), unless `whileTyping`; Enter and Space on a
  button, a link or a checkbox; the arrows, Home, End and the page keys
  on a slider, a separator, a list, a menu, tabs, a tree or a grid.
- **A key another handler has prevented is let be**, so a dialog's
  Escape or an editor's own keys come first; so is a key typed while
  an input method composes.
- **A key held down calls once**, unless `repeat`.
- **A matched key's default is prevented**, so the browser's own
  `mod+k` or `/` does not run too. One handler runs for a key: the
  first chord that matches, in the order they are written.
- **A letter is known by the key it is on** when the keyboard types
  another for it, as Option does on a Mac or a keyboard in another
  alphabet; a symbol is matched as typed, with the Shift it takes.
- **The handlers are read when a key is pressed**, so they need no
  memoising, and changing one listens again for nothing.
- **Its server value**: nothing, as it listens only in a browser.
  **Cleaning up**: its one `keydown` listener goes when `enabled` turns
  off, and with the component.

@bh/shell's [AppShell](../../shell/docs/app-shell.md) opens its search on `mod+k`
with it, a field's included.

## Reference

```ts
useHotkeys(options: UseHotkeysOptions): void
```

Keys that work anywhere on the page: `mod+k` to search, `/` to find, `?`
for help. A key the focused element uses itself is left to it: anything
typed into a field, unless `whileTyping`; Enter and Space on a button or a
link; the arrows on a slider, a list or a menu. So is a key another
handler has already prevented, one typed while an input method composes,
and, unless `repeat`, a key held down as it repeats.

A matched key's default is prevented, so the browser's own `mod+k` does
not run too. The handlers are read when a key is pressed, so they need no
memoising. It draws nothing and wires nothing: it listens on the window.

| Parameter                 | Type                                      | Default | Description                                                                                                                                                                                             |
| ------------------------- | ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `options` (required)      | `UseHotkeysOptions`                       |         |                                                                                                                                                                                                         |
| `options.keys` (required) | `Readonly<Record<string, HotkeyHandler>>` |         | Each key and what it does. A key is written as `Kbd` writes it, with `+` between the keys of a chord: `mod+k`, `shift+mod+z`, `/`, `escape`, `alt+up`. `mod` is Command on a Mac and Control elsewhere. |
| `options.enabled`         | `boolean`                                 | `true`  | Whether the keys work. `true` unless given.                                                                                                                                                             |
| `options.whileTyping`     | `boolean`                                 | `false` | Whether they work while the reader types in a field too, as a search's `mod+k` does. `false` unless given.                                                                                              |
| `options.repeat`          | `boolean`                                 | `false` | Whether a key held down calls again as it repeats, as moving through a list wants. `false` unless given.                                                                                                |

Returns `void`.

```ts
interface UseHotkeysOptions
```

What `useHotkeys` takes.

| Member            | Type                                      | Default | Description                                                                                                                                                                                             |
| ----------------- | ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keys` (required) | `Readonly<Record<string, HotkeyHandler>>` |         | Each key and what it does. A key is written as `Kbd` writes it, with `+` between the keys of a chord: `mod+k`, `shift+mod+z`, `/`, `escape`, `alt+up`. `mod` is Command on a Mac and Control elsewhere. |
| `enabled`         | `boolean`                                 |         | Whether the keys work. `true` unless given.                                                                                                                                                             |
| `whileTyping`     | `boolean`                                 |         | Whether they work while the reader types in a field too, as a search's `mod+k` does. `false` unless given.                                                                                              |
| `repeat`          | `boolean`                                 |         | Whether a key held down calls again as it repeats, as moving through a list wants. `false` unless given.                                                                                                |

```ts
type HotkeyHandler = (event: KeyboardEvent) => void;
```

What a key does: called with the `keydown` it matched, whose default is already prevented.
