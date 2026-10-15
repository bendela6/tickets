---
title: FoldCard
summary: 'A Card whose header folds it: a chevron, the title, and a summary
  while folded.'
related: [Card, Disclosure]
---

[//]: # 'written from fold-card.doc.yaml by pnpm docs:sync; edit that file, not this one'

# FoldCard

A Card whose header folds it: a chevron, the title, and a summary while
folded.

Open, it is a [Card](../card/card.md) with a header over a body,
the same padding, rule and type. Folded, the header is the whole card,
and the summary says what is in it.

## Import

```tsx
import { FoldCard } from '@bh/ui';
```

## Examples

With no `open`, the card holds its own state and starts folded;
`defaultOpen` starts it open. A click anywhere on the header opens it.

**Folded**

```tsx
import { FoldCard } from '@bh/ui';

export function Folded() {
  return (
    <FoldCard
      title="Export"
      summary="PNG, 1280 pixels wide, to the shared folder"
      className="w-480 max-w-full"
    >
      <p className="text-13/19 text-gray-11">
        Every page is exported as its own file, named after the page.
      </p>
    </FoldCard>
  );
}
```

Pass `open` and `onOpenChange` to hold the state yourself. A summary
made from the content keeps the folded card saying what it holds.

**Controlled**

```tsx
import { useState } from 'react';
import { Field, FoldCard, Input } from '@bh/ui';

export function Controlled() {
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('north-wing');
  return (
    <FoldCard
      title="Project"
      summary={name || 'No name yet'}
      open={open}
      onOpenChange={setOpen}
      className="w-480 max-w-full"
    >
      <Field id="fold-card-name" label="Name" hint="Its files are named after it.">
        <Input id="fold-card-name" value={name} onChange={setName} className="font-mono" />
      </Field>
    </FoldCard>
  );
}
```

The body pads by 16 pixels, as a `CardBody` does. `padding={0}` lets
content run to the edges: a list with its own rules, or a table.

**To the edges**

```tsx
import { FoldCard } from '@bh/ui';

const FILES = ['index.html', 'styles.css', 'main.js'];

export function ToTheEdges() {
  return (
    <FoldCard
      title="Files"
      summary={`${FILES.length} files`}
      padding={0}
      defaultOpen
      className="w-400 max-w-full"
    >
      <ul>
        {FILES.map((file) => {
          return (
            <li
              key={file}
              className="border-gray-5 text-13/19 text-gray-12 border-b-1 px-16 py-8 font-mono last:border-b-0"
            >
              {file}
            </li>
          );
        })}
      </ul>
    </FoldCard>
  );
}
```

## Keyboard and accessibility

| Key                | Does                     |
| ------------------ | ------------------------ |
| `Enter` or `Space` | Opens or folds the card. |

The header is a `<button>` inside an `h3`, so the card is a heading to
jump to, as a card's `CardTitle` is. The button has `aria-expanded`, and
`aria-controls` pointing at the body while it is drawn; it is named by
the title and described by the summary. The body is drawn only while
open, so state inside it belongs in the caller.

Its open state, and the props on the header's button and the body, are
[useDisclosure](../../../../../../hooks/docs/use-disclosure.md)'s, as Disclosure's are.

## Props

| Prop                  | Type                                         | Default | Description                                                                                                                                        |
| --------------------- | -------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` (required)    | `ReactNode`                                  |         | The card's title, in its header beside the chevron.                                                                                                |
| `summary`             | `ReactNode`                                  |         | Beside the title while folded: what the card holds, cut to one line, and cut first in a narrow card, so the title keeps its words. Gone once open. |
| `open`                | `boolean`                                    |         | Whether it is open. Leave it out and the card holds its own, from `defaultOpen`.                                                                   |
| `defaultOpen`         | `boolean`                                    | `false` | Whether it starts open, when `open` is left out.                                                                                                   |
| `onOpenChange`        | `(open: boolean) => void`                    |         | Called with the new state on every click, whether `open` is given or not.                                                                          |
| `padding`             | `Padding`: `0`, `1`, `2`, `3`, `4`, `6`, `8` | `4`     | Space around the content, in steps of 4 pixels, as CardBody's: 0 for content that runs to the edges.                                               |
| `className`           | `string`                                     |         | Added to the card's classes.                                                                                                                       |
| `children` (required) | `ReactNode`                                  |         | What the card holds, under its header, drawn only while open.                                                                                      |
