---
title: useScrollSpy
summary: Which of a page's sections is in view, by their ids, for an "On this
  page" list that lights it.
order: 3
related: [Writing a hook, Overview, OnThisPage]
---

[//]: # 'written from use-scroll-spy.doc.yaml by pnpm docs:sync; edit that file, not this one'

# useScrollSpy

Which of a page's sections is in view, by their ids, for an "On this
page" list that lights it. The hook watches the scroll and says which
section; the caller draws the list, marks the entry, and scrolls to a
section when its entry is clicked.

## Import

```tsx
import { useScrollSpy } from '@bh/hooks';
```

## Examples

The sections scroll in a box of their own, which the example keeps in
state and passes as `root`: `null` until the box is on the page, while
the hook watches nothing. Left out, `root` is the window. The section in
view is the last whose top has scrolled past `offset`, here 24 pixels
below the box's top: scroll the box, and the entry for the section at
its top is lit.

**An outline that follows**

```tsx
import { useState } from 'react';
import { useScrollSpy } from '@bh/hooks';

const SECTIONS = [
  {
    id: 'sowing',
    title: 'Sowing',
    text: 'Sow hardy seeds outside once the soil crumbles in the hand, and tender ones on a windowsill six weeks before the last frost.',
  },
  {
    id: 'watering',
    title: 'Watering',
    text: 'Water the roots, not the leaves, in the morning or the evening, and less often but deeply, so the roots go down after it.',
  },
  {
    id: 'pruning',
    title: 'Pruning',
    text: 'Cut back to just above a bud that faces out, with a clean slanting cut, so the rain runs off and the new shoot grows away from the middle.',
  },
  {
    id: 'harvest',
    title: 'Harvest',
    text: 'Pick in the cool of the morning, and pick often: a plant that is picked keeps flowering and fruiting.',
  },
  {
    id: 'winter',
    title: 'Winter',
    text: 'Leave the seed heads for the birds, mulch the beds, and wrap the pots that would crack in a frost.',
  },
];

const IDS = SECTIONS.map((section) => section.id);

export function AnOutlineThatFollows() {
  // The box the sections scroll in, kept in state: null until it is on the page.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const { activeId, pin } = useScrollSpy(IDS, { root, offset: 24 });

  return (
    <div className="flex w-full max-w-560 gap-16">
      <nav aria-label="The garden year" className="flex w-112 shrink-0 flex-col">
        {SECTIONS.map((section) => {
          const active = section.id === activeId;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault();
                // Lit at once, and kept lit while the box scrolls to it.
                pin(section.id);
                const target = document.getElementById(section.id);
                if (root && target) {
                  root.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' });
                }
              }}
              className={
                active
                  ? 'text-13 font-500 text-gray-12 border-indigo-9 border-l-2 py-4 pl-10'
                  : 'text-13 text-gray-11 hover:text-gray-12 border-l-2 border-transparent py-4 pl-10'
              }
            >
              {section.title}
            </a>
          );
        })}
      </nav>
      <div
        ref={setRoot}
        className="border-gray-6 rounded-8 relative h-240 min-w-0 flex-1 overflow-y-auto border-1 p-16"
      >
        {SECTIONS.map((section) => {
          return (
            <section key={section.id} id={section.id} className="flex flex-col gap-6 pb-32">
              <h3 className="text-14 font-600 text-gray-12">{section.title}</h3>
              <p className="text-13/19 text-gray-11">{section.text}</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
```

The box can't scroll Winter up to the line, since nothing follows it;
scrolled to its end, the last section is the one in view, as **Winter**
shows. A page that doesn't scroll at all goes by the line, and lights
its first section.

## Pinning an entry

A click on an entry calls `pin` with its id, then scrolls to the
section. Pinned, the section is the one in view at once, and stays so
while the page scrolls from code past the sections before it, until the
reader scrolls by hand: the wheel or a touch on the root, or a key.
Click **Sowing**, then **Pruning**: each is lit before the box gets
there. The hook doesn't scroll: the caller does, with the root's
`scrollTo` or the section's `scrollIntoView`, and puts the id in the
address bar if it wants one there.

[OnThisPage](../../shell/docs/on-this-page.md), in `@bh/shell/layout`, is built on
it, with the shell's `<main>` as its root and a line 120 pixels down:
the list down the right of this page on a wide screen.

## Rules

- **Its server value** is the first id: a page not yet scrolled.
- **What it watches**: the root's scroll and the window's resize, once
  the root is known; while a section is pinned, the wheel and touches
  on the root and keys on the window too. It removes each when it is
  no longer needed, and all of them at unmount.
- **What keeps its identity**: `pin`, for the hook's life. `ids` can be
  a new array on each render: it watches the same ids by their text,
  and subscribes once.
- **New ids drop a pin**, so a section pinned on one page doesn't stay
  lit on the next, though that has a section of the same name.
- **An id with no element on the page** is passed over, and `pin`
  with an id not in `ids` lights nothing new.
- It reads where each section is on every scroll, so it is meant for
  the sections of one page, tens and not thousands.

## Reference

```ts
useScrollSpy(ids: readonly string[], options?: UseScrollSpyOptions): UseScrollSpyResult
```

Which of a page's sections is in view, by their ids, for an "On this page"
list that lights it: the last section whose top has scrolled past
`offset`. It draws nothing and wires no element; the caller draws the
list, marks the entry (`aria-current`), and calls `pin` from its click.

| Parameter        | Type                  | Default | Description                                                                                                                                                                                                                                               |
| ---------------- | --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ids` (required) | `readonly string[]`   |         | The sections' element ids, in the order they come on the page.                                                                                                                                                                                            |
| `options`        | `UseScrollSpyOptions` | `{}`    | Where the sections scroll, and where the line is.                                                                                                                                                                                                         |
| `options.root`   | `Element \| null`     |         | The element the sections scroll in, as an app shell's `<main>`; the window when left out. `null` while it is not known yet, as an element kept in state before its ref has run: nothing is watched until it is, and the first section is the one in view. |
| `options.offset` | `number`              | `0`     | How far below the top of `root` a section's top has to pass to be the one in view, in pixels, 0 unless given: the height of a sticky header, or a line a little way down where reading starts.                                                            |

Returns `UseScrollSpyResult`.

```ts
interface UseScrollSpyOptions
```

What `useScrollSpy` takes after the sections' ids. Every option is optional.

| Member   | Type              | Default | Description                                                                                                                                                                                                                                               |
| -------- | ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`   | `Element \| null` |         | The element the sections scroll in, as an app shell's `<main>`; the window when left out. `null` while it is not known yet, as an element kept in state before its ref has run: nothing is watched until it is, and the first section is the one in view. |
| `offset` | `number`          |         | How far below the top of `root` a section's top has to pass to be the one in view, in pixels, 0 unless given: the height of a sticky header, or a line a little way down where reading starts.                                                            |

```ts
interface UseScrollSpyResult
```

What `useScrollSpy` gives back: the section in view, then the action that pins one.

| Member                | Type                   | Default | Description                                                                                                                                                                                                                                                          |
| --------------------- | ---------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeId` (required) | `string`               |         | The id of the section in view: the last whose top has passed `offset`, the first before any has, and the last once a page that scrolls is scrolled to its end. The pinned one while one is. `undefined` with no ids.                                                 |
| `pin` (required)      | `(id: string) => void` |         | Makes `id` the one in view until the reader scrolls by hand, with the wheel, a touch or a key: for a click on its entry, while the page scrolls to it, and when a short page bottoms out before its section reaches the line. The same function for the hook's life. |
