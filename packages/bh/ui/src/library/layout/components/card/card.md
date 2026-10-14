---
title: Card
summary: A raised surface with a border, for a panel of content.
related: [CardState, Figures, Meter, SectionHeader, Stack]
---

[//]: # 'written from card.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Card

A raised surface with a border, for a panel of content.

A card with a `CardHeader` keeps its own `padding` at 0, the default, so
the header's rule reaches both edges, and the `CardBody` under it pads the
content. A card with no header sets `padding` itself. Setting `padding`
and using a `CardHeader` together is the one pairing that draws wrong.

## Import

```tsx
import { Card, CardBody, CardHeader, CardTitle } from '@bh/ui';
```

## Examples

A header with its title, then a body. `CardHeader` pads itself, and
`CardBody` pads by 16 pixels unless its `padding` says otherwise.

**With header**

```tsx
import { Card, CardBody, CardHeader, CardTitle } from '@bh/ui';

export function WithHeader() {
  return (
    <Card className="w-320">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-13/19 text-gray-11">
          The card keeps no padding, so the header's rule reaches both edges.
        </p>
      </CardBody>
    </Card>
  );
}
```

`aside` sets something at the right end of the title's line: a figure,
a link, a range picker. It takes small grey type unless it sets its own,
and keeps the spaces between its words and links. Without one, the header
is a plain block.

**With an aside**

```tsx
import { Card, CardBody, CardHeader, CardTitle } from '@bh/ui';

export function WithAnAside() {
  return (
    <div className="flex w-320 flex-col gap-12">
      <Card>
        <CardHeader aside="4 cores · up 3 d 4 h">
          <CardTitle>Machine</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-13/19 text-gray-11">The aside is small grey type by default.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          aside={
            <>
              12 of 14 running ·{' '}
              <a href="#all" className="text-gray-12 underline-offset-2 hover:underline">
                See all
              </a>
            </>
          }
        >
          <CardTitle>Services</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-13/19 text-gray-11">Words and a link keep their spaces.</p>
        </CardBody>
      </Card>
    </div>
  );
}
```

With no header, `padding` pads the card, in steps of 4 pixels: `padding={4}`
is 16.

**Headerless**

```tsx
import { Card } from '@bh/ui';

export function Headerless() {
  return (
    <Card padding={4} className="w-320">
      <p className="text-13/19 text-gray-11">A card with no header sets its own padding.</p>
    </Card>
  );
}
```

`radius` rounds the corners: `md` 6 pixels, `lg` 8, and `xl`, the
default, 12.

**Radii**

```tsx
import { Card } from '@bh/ui';

export function Radii() {
  return (
    <div className="flex flex-col gap-12">
      <Card radius="md" padding={3} className="w-320">
        <p className="text-13/19 text-gray-11">md</p>
      </Card>
      <Card radius="lg" padding={3} className="w-320">
        <p className="text-13/19 text-gray-11">lg</p>
      </Card>
      <Card radius="xl" padding={3} className="w-320">
        <p className="text-13/19 text-gray-11">xl</p>
      </Card>
    </div>
  );
}
```

A card that is a link or a button is that element itself: `asChild`
draws the card on the one element it wraps, an `<a>` or a router's link,
instead of a `<div>`. `interactive` lifts its border on hover and shows
a pointer. Tab reaches it, and focus lights its border and draws the halo
the controls draw.

**Link card**

```tsx
import { Card } from '@bh/ui';

export function LinkCard() {
  return (
    <Card asChild interactive padding={4} className="w-320">
      <a href="#">
        <p className="text-13/19 font-600 text-gray-12">Annual report</p>
        <p className="text-12/17 text-gray-11">report.pdf, 2.4 MB</p>
      </a>
    </Card>
  );
}
```

On a `<button>`, the card keeps its text at its left edge, as a card's
is. A grid's cells give them their width.

**Button card**

```tsx
import { useState } from 'react';
import { Card, Icon } from '@bh/ui';

export function ButtonCard() {
  const [made, setMade] = useState(0);
  return (
    <div className="grid w-320 grid-cols-2 gap-8">
      <Card asChild interactive padding={4}>
        <button type="button" onClick={() => setMade(made + 1)}>
          <Icon name="plus" size="lg" className="text-gray-11" />
          <span className="text-13/19 font-600 text-gray-12 mt-8 block">New folder</span>
          <span className="text-12/17 text-gray-11 block">{made} made</span>
        </button>
      </Card>
      <Card asChild interactive padding={4}>
        <button type="button" onClick={() => setMade(made + 1)}>
          <Icon name="file" size="lg" className="text-gray-11" />
          <span className="text-13/19 font-600 text-gray-12 mt-8 block">New file</span>
          <span className="text-12/17 text-gray-11 block">Empty, untitled</span>
        </button>
      </Card>
    </div>
  );
}
```

## Keyboard and accessibility

`CardTitle` is always an `h3`. For another level, put your own heading in
the `CardHeader`. Other attributes reach the `<div>`, or with `asChild`
the element it wraps, so a card can take a `role` and an `aria-label`.
A card that is a link or a button is named by what it holds; a heading
inside a `<button>` isn't a heading to a screen reader, so a button card
holds lines of text in spans, as above: a `<button>` holds no `<p>`.

## Props

### Card

| Prop          | Type                                         | Default | Description                                                                                                                                                                        |
| ------------- | -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `radius`      | `CardRadius`: `'md'`, `'lg'`, `'xl'`         | `'xl'`  | How round the corners are: 6, 8 or 12 pixels.                                                                                                                                      |
| `padding`     | `Padding`: `0`, `1`, `2`, `3`, `4`, `6`, `8` | `0`     | Space inside the edge, in steps of 4 pixels. Leave it 0 when the card has a CardHeader.                                                                                            |
| `interactive` | `boolean`                                    |         | Adds the hover border-lift and pointer cursor for a card that is a link or a button. Does not make a `<div>` focusable: with `asChild`, the card is the link or the button itself. |
| `asChild`     | `boolean`                                    | `false` | Draws the card on the one element it wraps instead of a `<div>`: a `<button>`, or a router's link, which                                                                           |
| `className`   | `string`                                     |         | Added to its own classes.                                                                                                                                                          |
| `children`    | `ReactNode`                                  |         |                                                                                                                                                                                    |
| `ref`         | `Ref<HTMLDivElement>`                        |         | Forwarded to the `<div>`.                                                                                                                                                          |

Also every `<div>` attribute (`HTMLAttributes<HTMLDivElement>`), passed through.

### CardHeader

| Prop        | Type        | Default | Description                                                                                                        |
| ----------- | ----------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `children`  | `ReactNode` |         | The header's content: a CardTitle, as a rule.                                                                      |
| `aside`     | `ReactNode` |         | At the right end of the title's line, in small grey type unless it sets its own: a figure, a link, a range picker. |
| `className` | `string`    |         | Added to its own classes.                                                                                          |

Also every `<div>` attribute (`HTMLAttributes<HTMLDivElement>`), passed through.

### CardTitle

| Prop        | Type     | Default | Description               |
| ----------- | -------- | ------- | ------------------------- |
| `className` | `string` |         | Added to its own classes. |

Also every element attribute (`HTMLAttributes<HTMLHeadingElement>`), passed through.

### CardBody

| Prop        | Type                                         | Default | Description                                     |
| ----------- | -------------------------------------------- | ------- | ----------------------------------------------- |
| `padding`   | `Padding`: `0`, `1`, `2`, `3`, `4`, `6`, `8` | `4`     | Space around the content, in steps of 4 pixels. |
| `className` | `string`                                     |         | Added to its own classes.                       |

Also every `<div>` attribute (`HTMLAttributes<HTMLDivElement>`), passed through.
