---
title: Disclosure
summary: 'A row that folds what follows it: a chevron, a title, and a summary
  while folded.'
related: [FoldCard, SectionHeader, Tree]
---

[//]: # 'written from disclosure.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Disclosure

A row that folds what follows it: a chevron, a title, and a summary while
folded.

A click on the row opens it, and the content follows the row, in line
with the title. The content is drawn only while open, so a fold of a long
list or a log costs nothing until it is opened.

## Import

```tsx
import { Disclosure } from '@bh/ui';
```

## Examples

Sections of a form, one under another. `summary` says what a section
holds while it is folded, and goes when it opens; `rule` runs a line to
the row's end, which sets one section apart from the next. With no
`open`, each holds its own state, and `defaultOpen` opens one to start.

**Sections**

```tsx
import { useState } from 'react';
import { Disclosure, Field, Input } from '@bh/ui';

export function Sections() {
  const [width, setWidth] = useState('1280');
  const [quality, setQuality] = useState('85');
  return (
    <div className="flex w-480 max-w-full flex-col">
      <Disclosure title="Size" summary={`${width} pixels wide`} rule defaultOpen>
        <Field
          id="sections-width"
          label="Width"
          hint="In pixels; the height follows."
          className="w-160"
        >
          <Input id="sections-width" inputMode="numeric" value={width} onChange={setWidth} />
        </Field>
      </Disclosure>
      <Disclosure title="Quality" summary={`${quality} of 100`} rule>
        <Field id="sections-quality" label="Quality" className="w-160">
          <Input id="sections-quality" inputMode="numeric" value={quality} onChange={setQuality} />
        </Field>
      </Disclosure>
      <Disclosure title="Metadata" summary="Kept: the date, the camera, the place" rule>
        <p className="text-13/19 text-gray-11">Every field the file came with is kept.</p>
      </Disclosure>
    </div>
  );
}
```

`size="sm"` is a quiet 12-pixel line in the text's own gray, as wide as
its words, for a detail folded away under what it belongs to.

**A quiet line**

```tsx
import { Disclosure } from '@bh/ui';

const RELEASES = [
  { version: 'v1.4.0', note: 'A date range can be picked by month.' },
  { version: 'v1.3.2', note: 'A chip no longer nests a button in a button.' },
];

export function AQuietLine() {
  return (
    <div className="flex w-400 max-w-full flex-col gap-8">
      <p className="text-13/19 text-gray-12">v1.3.1 is two releases behind.</p>
      <Disclosure size="sm" title="What changed since v1.3.1">
        <ul className="text-12/17 text-gray-11 flex flex-col gap-4">
          {RELEASES.map((release) => {
            return (
              <li key={release.version}>
                <span className="text-gray-12 font-mono">{release.version}</span> {release.note}
              </li>
            );
          })}
        </ul>
      </Disclosure>
    </div>
  );
}
```

Pass `open` and `onOpenChange` to hold the state yourself, to open or
fold several at once. `onOpenChange` is called with the new state either
way.

**Controlled**

```tsx
import { useState } from 'react';
import { Button, Disclosure } from '@bh/ui';

const SECTIONS = [
  { key: 'size', title: 'Size', summary: '1280 by 720' },
  { key: 'colour', title: 'Colour', summary: 'sRGB, 8 bits' },
];

export function Controlled() {
  const [open, setOpen] = useState<Record<string, boolean>>({ size: true, colour: false });
  const all = (to: boolean) => setOpen({ size: to, colour: to });
  return (
    <div className="flex w-400 max-w-full flex-col gap-8">
      <div className="flex gap-8">
        <Button size="sm" variant="ghost" tone="neutral" onClick={() => all(true)}>
          Open all
        </Button>
        <Button size="sm" variant="ghost" tone="neutral" onClick={() => all(false)}>
          Fold all
        </Button>
      </div>
      {SECTIONS.map((section) => {
        return (
          <Disclosure
            key={section.key}
            title={section.title}
            summary={section.summary}
            rule
            open={open[section.key] ?? false}
            onOpenChange={(next) => setOpen({ ...open, [section.key]: next })}
          >
            <p className="text-13/19 text-gray-11">The {section.title.toLowerCase()} settings.</p>
          </Disclosure>
        );
      })}
    </div>
  );
}
```

## Keyboard and accessibility

| Key                | Does               |
| ------------------ | ------------------ |
| `Enter` or `Space` | Opens or folds it. |

The row is a `<button>` with `aria-expanded`, and `aria-controls`
pointing at the content while it is drawn. It is named by its title and
described by its summary, so a screen reader says the title, whether it
is open, then what it holds. The chevron turns, and stops turning for a
reader who asks for less motion.

State inside the content, an input's text say, goes when it folds, so
keep it in the caller, as a controlled input's already is.

## When not to use it

- For a card that folds as a whole, use
  [FoldCard](../fold-card/fold-card.md).
- For a hierarchy the keyboard walks, use
  [Tree](../../../navigation/components/tree/tree.md).
- For a caption over a section that stays open, use
  [SectionHeader](../section-header/section-header.md).

## Props

| Prop                  | Type                             | Default | Description                                                                                                                                 |
| --------------------- | -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` (required)    | `ReactNode`                      |         | What it folds, named beside the chevron.                                                                                                    |
| `summary`             | `ReactNode`                      |         | Beside the title while folded: what is in it, cut to one line, and cut first in a narrow row, so the title keeps its words. Gone once open. |
| `open`                | `boolean`                        |         | Whether it is open. Leave it out and the row holds its own, from `defaultOpen`.                                                             |
| `defaultOpen`         | `boolean`                        | `false` | Whether it starts open, when `open` is left out.                                                                                            |
| `onOpenChange`        | `(open: boolean) => void`        |         | Called with the new state on every click, whether `open` is given or not.                                                                   |
| `size`                | `DisclosureSize`: `'sm'`, `'md'` | `'md'`  | `md`, a section's 13-pixel title over a hover fill; `sm`, a quiet 12-pixel line.                                                            |
| `rule`                | `boolean`                        | `false` | Draws a rule from the title to the row's end, to set a section apart from the next.                                                         |
| `className`           | `string`                         |         | Added to the outer element's classes.                                                                                                       |
| `children` (required) | `ReactNode`                      |         | What it folds: under the row, in line with the title, drawn only while open.                                                                |
