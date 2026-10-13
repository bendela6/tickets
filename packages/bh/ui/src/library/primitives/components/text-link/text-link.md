---
title: TextLink
summary: 'A link in a line of text: its strongest gray, underlined under the pointer.'
related: [Button, Card]
---

[//]: # 'written from text-link.doc.yaml by pnpm docs:sync; edit that file, not this one'

# TextLink

A link in a line of text: its strongest gray, underlined under the
pointer.

It is an `<a>`. With `asChild` it styles the one element it wraps
instead, so a router's link, or a `<button>` that reads as a link, looks
the same as any other.

## Import

```tsx
import { TextLink } from '@bh/ui';
```

## Examples

In a line of gray text, the link is the line's one strong word. Other
classes, a weight or the mono face, go in `className`.

**In a line**

```tsx
import { TextLink } from '@bh/ui';

export function InALine() {
  return (
    <p className="text-12/17 text-gray-11">
      From <TextLink href="#">the design library</TextLink>, newest{' '}
      <TextLink href="#" className="font-600 font-mono">
        v1.4.0
      </TextLink>
      , released two days ago.
    </p>
  );
}
```

A colour in `className` wins over its own, for a link that reports a
failure or a warning. `text-inherit` takes the colour of the text around
it.

**Colours**

```tsx
import { TextLink } from '@bh/ui';

export function Colours() {
  return (
    <p className="text-12/17 text-gray-11 flex flex-wrap gap-x-12 gap-y-4">
      <TextLink href="#">Run 41 is live</TextLink>
      <TextLink href="#" className="text-red-11">
        Run 42 failed
      </TextLink>
      <TextLink href="#" className="text-orange-11">
        2 settings missing
      </TextLink>
      <TextLink href="#" className="font-mono text-inherit">
        main@4f2a91c
      </TextLink>
    </p>
  );
}
```

`asChild` with a `<button>` makes an action that sits in the text, as
showing or hiding what follows, read as a link. It stays a button, with
its own `onClick`, and its own `disabled`, which grays it.

**A button**

```tsx
import { useState } from 'react';
import { TextLink } from '@bh/ui';

const FILES = ['report.pdf', 'summary.csv', 'chart.png'];

export function AButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-12/17 text-gray-11 flex flex-col gap-6">
      <p>
        Exported {FILES.length} files ·{' '}
        <TextLink asChild>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide them' : 'Show them'}
          </button>
        </TextLink>
      </p>
      {open ? (
        <ul className="text-gray-12 font-mono">
          {FILES.map((file) => {
            return <li key={file}>{file}</li>;
          })}
        </ul>
      ) : null}
    </div>
  );
}
```

@bh/ui knows no router, so a router's link is the child. It still draws
its own `<a>` and keeps its props; TextLink adds its classes, merged with
the child's, and the props it is given.

```tsx
import { Link } from '@tanstack/react-router';
import { TextLink } from '@bh/ui';

export function SettingsLink() {
  return (
    <TextLink asChild>
      <Link to="/settings">Settings</Link>
    </TextLink>
  );
}
```

## Keyboard and accessibility

| Key     | Does                                                               |
| ------- | ------------------------------------------------------------------ |
| `Tab`   | Moves onto the link, which takes an `href` to be in the tab order. |
| `Enter` | Follows the link, or presses the button it wraps.                  |

It keeps the element's own role: an `<a>` with an `href` is a link, a
router's link is too, and a `<button>` stays a button, which Space also
presses. Focus draws the library's inward rim around the text, since a
halo would spill over the lines above and below it. Other attributes,
`ref` among them, reach the element.

## When not to use it

- For an action that stands on its own rather than in a sentence, use a
  [Button](../button/button.md), `variant="ghost"` for a quiet
  one.
- For a whole card that is a link, put the
  [Card](../../../layout/components/card/card.md) inside the link.

## Props

| Prop        | Type                     | Default | Description                                                                                                         |
| ----------- | ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `asChild`   | `boolean`                | `false` | Styles the one element it wraps instead of drawing an `<a>`: a router's link, or a `<button>` that reads as a link. |
| `className` | `string`                 |         | Added to its classes, where a colour or a size wins over its own.                                                   |
| `children`  | `ReactNode`              |         | The link's text; with `asChild`, the one element it styles.                                                         |
| `ref`       | `Ref<HTMLAnchorElement>` |         | Forwarded to the `<a>`.                                                                                             |

Also every `<a>` attribute (`AnchorHTMLAttributes<HTMLAnchorElement>`), passed through.
