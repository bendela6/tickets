---
title: useDisclosure
summary: Open and fold a region from a button, with the props for both and no
  markup of its own.
order: 3
related: [Writing a hook, Disclosure, FoldCard]
---

[//]: # 'written from use-disclosure.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useDisclosure

Open and fold a region from a button, with the props for both and no
markup of its own: the button's `aria-expanded` and `aria-controls`,
the region's `id` and `hidden`, and the open state. How the two look,
and whether the region is drawn at all while folded, is the caller's.

## Import

```tsx
import { useDisclosure } from '@bh/hooks';
```

## Examples

**A plain fold**

```tsx
import { useDisclosure } from '@bh/hooks';

// Questions that fold their answers: a heading with a button inside it, and
// the paragraph it folds, with no component of bh's between them.

const BUTTON = 'rounded-6 hover:bg-gray-3 -mx-8 w-full px-8 py-6 text-left';

function Question({ question, answer }: { question: string; answer: string }) {
  const fold = useDisclosure();
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-13/19 font-500 text-gray-12">
        <button {...fold.getTriggerProps({ className: BUTTON })}>
          {fold.isOpen ? '−' : '+'} {question}
        </button>
      </h3>
      <p {...fold.getRegionProps({ className: 'text-13/19 text-gray-11' })}>{answer}</p>
    </div>
  );
}

export function APlainFold() {
  return (
    <div className="flex w-320 flex-col gap-8">
      <Question question="How long does shipping take?" answer="Two days, in one box." />
      <Question question="Can I return it?" answer="Yes, free for thirty days." />
    </div>
  );
}
```

Each question is a heading with a button inside it: the trigger is a
`<button>` and nothing else, so the browser opens it with a click,
Enter or Space, and gives it a place in the tab order. A row or a
heading that folds puts a button inside it, as here, and spreads
`getTriggerProps()` on the button. The answer stays in the page,
`hidden` while folded.

Each getter takes your props for the element and merges them in: a
class, a ref, a label, and your own `onClick`, which runs first.

## Held by the caller

**Folded from the page**

```tsx
import { useState } from 'react';
import { useDisclosure } from '@bh/hooks';

// The page holds which sections are open, so it can open or fold them all;
// each section's hook shows `open` and asks `onOpenChange` for a change.

const BUTTON = 'rounded-8 border-gray-6 border-1 px-12 py-6';
const SECTIONS = ['Shipping', 'Returns', 'Warranty'] as const;
type Section = (typeof SECTIONS)[number];

function Fold({
  name,
  open,
  onOpenChange,
}: {
  name: Section;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fold = useDisclosure({ open, onOpenChange });
  return (
    <div className="flex flex-col gap-4">
      <button {...fold.getTriggerProps({ className: 'text-left font-500' })}>
        {fold.isOpen ? '▾' : '▸'} {name}
      </button>
      {/* Drawn only while open: aria-controls is set only then, so it never points at nothing. */}
      {fold.isOpen ? (
        <p {...fold.getRegionProps({ className: 'text-13/19 text-gray-11 pl-16' })}>
          What to know about {name.toLowerCase()}.
        </p>
      ) : null}
    </div>
  );
}

export function FoldedFromThePage() {
  const [open, setOpen] = useState<ReadonlySet<Section>>(() => new Set(['Shipping']));
  return (
    <div className="flex w-320 flex-col gap-8">
      <div className="flex gap-8">
        <button type="button" className={BUTTON} onClick={() => setOpen(new Set(SECTIONS))}>
          Open all
        </button>
        <button type="button" className={BUTTON} onClick={() => setOpen(new Set())}>
          Fold all
        </button>
      </div>
      {SECTIONS.map((name) => {
        return (
          <Fold
            key={name}
            name={name}
            open={open.has(name)}
            onOpenChange={(next) => {
              const sections = new Set(open);
              if (next) {
                sections.add(name);
              } else {
                sections.delete(name);
              }
              setOpen(sections);
            }}
          />
        );
      })}
    </div>
  );
}
```

The page holds which sections are open, so **Open all** and **Fold
all** set them at once. Each section's hook shows the `open` it is
given and asks `onOpenChange` for a change, so a click opens a section
only because the page takes the change. Here the region is drawn only
while open: `aria-controls` is set only then, so it never points at an
element that isn't there.

## Rules

- **Its server value** is `open` if the caller holds it, or
  `defaultOpen`, which is folded unless given.
- **Held by the caller while it passes `open`**, decided on every
  render; the hook then keeps no copy, and a caller that declines a
  change keeps what it had. `defaultOpen` is read on the first render
  only.
- **`onOpenChange` hears every change**, whoever holds it: once, with
  the new value, and not for an action that changes nothing, as
  `open()` while open.
- **The trigger is a `<button>`**: `getTriggerProps()` sets
  `type="button"`, so it never submits a form it sits in.
- **Merging**: both handlers run, yours first; your ref and your other
  props pass through; its `type`, `id`, `hidden` and `aria-*` win, since
  they point at each other.
- **What keeps its identity**: `open`, `close`, `toggle` and `setOpen`,
  for the hook's life; `onOpenChange` is read when it is called, so it
  needs no memoising. The getters are new when what they return
  changes.
- It starts nothing, so there is nothing to clean up.

@bh/ui's [Disclosure](../../ui/src/library/layout/components/disclosure/disclosure.md) and
[FoldCard](../../ui/src/library/layout/components/fold-card/fold-card.md) are built on it, each drawing
its own row.

## Reference

```ts
useDisclosure(options?: UseDisclosureOptions): UseDisclosureResult
```

An open-or-folded state, with the props for the button that folds and the
region it folds, and no markup of its own. The browser makes the button
work with Enter and Space and gives it a place in the tab order.

Its server value is folded, or `defaultOpen`, or `open`.

| Parameter              | Type                      | Default | Description                                                                                  |
| ---------------------- | ------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `options`              | `UseDisclosureOptions`    | `{}`    |                                                                                              |
| `options.open`         | `boolean`                 |         | Whether it is open, for a caller that holds it; it then changes only through `onOpenChange`. |
| `options.defaultOpen`  | `boolean`                 | `false` | Whether it starts open, while the hook holds it. Read on the first render only.              |
| `options.onOpenChange` | `(open: boolean) => void` |         | Hears every change, with the new value, whoever holds it.                                    |
| `options.id`           | `string`                  |         | The region's id, for an app that needs a fixed one; `useId()` gives one otherwise.           |

Returns `UseDisclosureResult`.

```ts
interface UseDisclosureOptions
```

What `useDisclosure` takes. Every option is optional: `useDisclosure()`.

| Member         | Type                      | Default | Description                                                                                  |
| -------------- | ------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `open`         | `boolean`                 |         | Whether it is open, for a caller that holds it; it then changes only through `onOpenChange`. |
| `defaultOpen`  | `boolean`                 |         | Whether it starts open, while the hook holds it. Read on the first render only.              |
| `onOpenChange` | `(open: boolean) => void` |         | Hears every change, with the new value, whoever holds it.                                    |
| `id`           | `string`                  |         | The region's id, for an app that needs a fixed one; `useId()` gives one otherwise.           |

```ts
interface UseDisclosureResult
```

What `useDisclosure` gives back: state, actions, then prop getters.

| Member                       | Type                                                                                                                        | Default | Description                                                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isOpen` (required)          | `boolean`                                                                                                                   |         | Whether the region is open.                                                                                                                                                                                     |
| `open` (required)            | `() => void`                                                                                                                |         | Opens it. The same function for the hook's life, as every action is.                                                                                                                                            |
| `close` (required)           | `() => void`                                                                                                                |         | Folds it.                                                                                                                                                                                                       |
| `toggle` (required)          | `() => void`                                                                                                                |         | Opens it if folded, folds it if open.                                                                                                                                                                           |
| `setOpen` (required)         | `(open: boolean) => void`                                                                                                   |         | Opens or folds it.                                                                                                                                                                                              |
| `getTriggerProps` (required) | `( own?: ComponentProps<'button'>, ) => ComponentProps<'button'> & DisclosureTriggerProps`                                  |         | The trigger, a `<button>`: its `type`, `aria-expanded`, `aria-controls` while open, and its click, with yours merged in. A row or a heading that folds puts a button inside it, and spreads this on the button. |
| `getRegionProps` (required)  | `<Own extends HTMLAttributes<HTMLElement>>( own?: Own, ) => Omit<Own, keyof DisclosureRegionProps> & DisclosureRegionProps` |         | The region: its `id`, and `hidden` while folded, with yours merged in.                                                                                                                                          |

```ts
interface DisclosureTriggerProps
```

What `getTriggerProps` sets on the `<button>`, over the caller's own props.

| Member                     | Type                                             | Default | Description                                                                               |
| -------------------------- | ------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------- |
| `type` (required)          | `'button'`                                       |         |                                                                                           |
| `aria-expanded` (required) | `boolean`                                        |         |                                                                                           |
| `aria-controls` (required) | `string`                                         |         | The region's id while it is open; nothing while folded, when the region may not be there. |
| `onClick` (required)       | `(event: MouseEvent<HTMLButtonElement>) => void` |         | Folds or opens it, after the caller's own click.                                          |

```ts
interface DisclosureRegionProps
```

What `getRegionProps` sets on the region, over the caller's own props.

| Member              | Type      | Default | Description |
| ------------------- | --------- | ------- | ----------- |
| `id` (required)     | `string`  |         |             |
| `hidden` (required) | `boolean` |         |             |
