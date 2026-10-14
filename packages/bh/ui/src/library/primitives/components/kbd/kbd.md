---
title: Kbd
summary: 'A key hint: one key, or a chord, drawn as a key cap.'
related: [Tooltip, Menu, Input, Pill]
---

[//]: # 'written from kbd.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Kbd

A key hint: one key, or a chord, drawn as a key cap.

It only shows the key; the app binds it. `keys` names the keys, and the
component draws each the reader's platform's way, so one hint says `⌘K`
on a Mac and `Ctrl+K` elsewhere.

## Import

```tsx
import { Kbd } from '@bh/ui';
```

## Examples

`keys` takes one key, or the keys of a chord as an array,
`['mod', 'K']`, or as a string with `+` between them, `'mod+K'`, the
way data holds a shortcut. A `+` with nothing on one side is the key
itself, so `'mod++'` is `mod` and the plus key.

`mod` is Command on a Mac and Control elsewhere, the key most shortcuts
want. The modifiers (`shift`, `alt`, `ctrl`), `enter`, `esc`, `tab`,
`backspace`, `delete`, `space` and the arrows (`up`, `down`, `left`,
`right`) are named the platform's way too, in any case. A single letter
is drawn in capitals, and anything else as written: `F5`, `/`.

**Keys**

```tsx
import { Kbd } from '@bh/ui';

export function Keys() {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <Kbd keys="esc" />
      <Kbd keys="/" />
      <Kbd keys={['mod', 'K']} />
      <Kbd keys="mod+shift+P" />
      <Kbd keys="shift+up" />
      <Kbd keys="ctrl+enter" />
      <Kbd keys="F5" />
    </div>
  );
}
```

A Mac's glyphs are set side by side and a PC's words joined with `+`.
`platform` draws one platform's names whatever the reader's: unset, it
is the reader's own, found once from the browser, and a server render
draws `other`.

**Platforms**

```tsx
import { Kbd } from '@bh/ui';

const CHORDS = ['mod+K', 'mod+shift+Z', 'alt+left', 'mod+enter', 'backspace'];

export function Platforms() {
  return (
    <table className="text-13/19 text-gray-11 font-sans">
      <thead>
        <tr className="text-12 text-gray-10 text-left">
          <th className="font-500 pr-24 pb-8">Written</th>
          <th className="font-500 pr-24 pb-8">On a Mac</th>
          <th className="font-500 pb-8">Elsewhere</th>
        </tr>
      </thead>
      <tbody>
        {CHORDS.map((chord) => {
          return (
            <tr key={chord}>
              <td className="py-4 pr-24 font-mono">{chord}</td>
              <td className="py-4 pr-24">
                <Kbd keys={chord} platform="apple" />
              </td>
              <td className="py-4">
                <Kbd keys={chord} platform="other" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

`variant` says how the keys are drawn. `raised` is a key cap, for a key
on the page, in a field or in running text. `tint` is a cap tinted from
the colour around it, for a surface with a colour of its own, such as a
tooltip's. `text` is the keys alone, as a menu row draws them.

`size` sets the cap's height and type size together: 16, 18 and 20
pixels. `lg` sits in a 14-pixel line of text, `md` in a field or a menu
row, and `sm` in a tooltip.

Every combination of `Kbd`'s `variant` and `size`, with `keys="mod+K"`:

- `variant` (rows): `raised`, `tint`, `text`
- `size` (columns): `sm`, `md`, `lg`

In running text, at `lg`.

**In a sentence**

```tsx
import { Kbd } from '@bh/ui';

export function InASentence() {
  return (
    <p className="text-14/22 text-gray-12 max-w-480 font-sans">
      Press <Kbd keys="mod+K" size="lg" /> to search from anywhere, move through the results with{' '}
      <Kbd keys="up" size="lg" /> and <Kbd keys="down" size="lg" />, and open one with{' '}
      <Kbd keys="enter" size="lg" />.
    </p>
  );
}
```

At the end of a field, as an [Input](../../../inputs/components/input/input.md)'s
`trailing`. The field's label says what it is for, so the hint is
`aria-hidden` here.

**In a field**

```tsx
import { useState } from 'react';
import { Input, Kbd } from '@bh/ui';

export function InAField() {
  const [query, setQuery] = useState('');
  return (
    <div className="w-256">
      <Input
        aria-label="Filter"
        placeholder="Filter components…"
        value={query}
        onChange={setQuery}
        trailing={<Kbd keys="mod+K" aria-hidden />}
      />
    </div>
  );
}
```

As a [Menu](../../../overlays/components/menu/menu.md) item's `shortcut`, drawn as
`text`.

**In a menu**

```tsx
import { useState } from 'react';
import { Button, Kbd, Menu, MenuContent, MenuItem, MenuTrigger } from '@bh/ui';

export function InAMenu() {
  const [chosen, setChosen] = useState('nothing yet');
  return (
    <div className="flex items-center gap-12">
      <Menu>
        <MenuTrigger asChild>
          <Button chevron>Edit</Button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            shortcut={<Kbd keys="mod+Z" variant="text" />}
            onSelect={() => setChosen('Undo')}
          >
            Undo
          </MenuItem>
          <MenuItem
            shortcut={<Kbd keys="mod+shift+Z" variant="text" />}
            onSelect={() => setChosen('Redo')}
          >
            Redo
          </MenuItem>
          <MenuItem
            shortcut={<Kbd keys="mod+A" variant="text" />}
            onSelect={() => setChosen('Select all')}
          >
            Select all
          </MenuItem>
        </MenuContent>
      </Menu>
      <span className="text-13 text-gray-11">Chose {chosen}</span>
    </div>
  );
}
```

In a [Tooltip](../../../overlays/components/tooltip/tooltip.md), drawn as `tint` at `sm`.

**In a tooltip**

```tsx
import { Button, Icon, Kbd, Tooltip } from '@bh/ui';

export function InATooltip() {
  return (
    <Tooltip
      content={
        <span className="flex items-center gap-6">
          Copy <Kbd keys="mod+C" variant="tint" size="sm" />
        </span>
      }
    >
      <Button variant="ghost" aria-label="Copy" className="w-36 p-0">
        <Icon name="copy" />
      </Button>
    </Tooltip>
  );
}
```

## Keyboard and accessibility

A chord is one `<kbd>` holding a `<kbd>` for each key, as HTML writes a
key combination. A glyph is hidden from a screen reader and its word
read in its place, so `⌘K` is read as "Command+K". Other props, such as
`aria-hidden` and `title`, go on the outer `<kbd>`.

A hint does not bind its key. Give the control the key works on
`aria-keyshortcuts`, so a screen reader can say the shortcut there.

## When not to use it

- For a short label that is not a key, use
  [Pill](../pill/pill.md).

## Props

| Prop              | Type                                         | Default    | Description                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keys` (required) | `string \| readonly string[]`                |            | The key, or the keys of a chord: `['mod', 'K']`, or the same as a string with `+` between them, `'mod+K'`. `mod` is Command on a Mac and Control elsewhere; `shift`, `alt`, `ctrl`, `enter`, `esc`, `tab`, `backspace`, `delete`, `space` and the arrows (`up`) are named the platform's way too. A single letter is drawn in capitals, anything else as written. |
| `variant`         | `KbdVariant`: `'raised'`, `'tint'`, `'text'` | `'raised'` | How the keys are drawn: a raised cap, a cap tinted from the colour around it, or text alone.                                                                                                                                                                                                                                                                      |
| `size`            | `KbdSize`: `'sm'`, `'md'`, `'lg'`            | `'md'`     | The cap's height and type size: 16, 18 and 20 pixels.                                                                                                                                                                                                                                                                                                             |
| `platform`        | `KbdPlatform`: `'apple'`, `'other'`          |            | Whose names to draw: Apple's glyphs, or a PC's words. Unset, the reader's own.                                                                                                                                                                                                                                                                                    |
| `className`       | `string`                                     |            | Added to the outer `<kbd>`'s classes.                                                                                                                                                                                                                                                                                                                             |

Also every element attribute (`HTMLAttributes<HTMLElement>`), passed through.
