---
title: OnThisPage
summary: List a page's sections beside it, the one being read lit as the page
  scrolls, and go to one with a click.
order: 7
related: [Pages, Pager, useScrollSpy]
---

[//]: # 'written from on-this-page.doc.yaml by pnpm docs:sync; edit that file, not this one'

# OnThisPage

List a page's sections beside it, the one being read lit as the page
scrolls, and go to one with a click.

The app hands in the sections, from the page's headings, and puts the
list where it wants it: down the right of a reading page, as a rule,
kept in view while the page scrolls past. The list follows the scroll
with `useScrollSpy` from `@bh/hooks`, and lights the section being read
the way the sidebar lights the page on screen.

## Import

```tsx
import { OnThisPage, type PageSection } from '@bh/shell/layout';
```

## The sections

Each section is a `PageSection`: its heading's element `id`, which the
entry links to and the list watches, the `label` the entry says, and
the heading's `level`, 2 for an `h2` and 2 when left out, since a
page's title is its `h1`. A section is listed under the nearest one
before it with a lower level, so an `h3` sits under the `h2` before it,
one step in, and the lists nest for a screen reader as the headings do.

Below, the guide scrolls in a box of its own, which the example keeps
in state and passes as `root`, and its line is 24 pixels down, its
`offset`. Scroll the box, and the section at its top is lit; click
**Recasing**, and it is lit at once while the box scrolls there.

**Mending a book**

```tsx
import { useState } from 'react';
import { OnThisPage, type PageSection } from '@bh/shell/layout';

interface Part extends PageSection {
  text: string;
}

// Each section's level is its heading's: h3s, with two h4s under A broken spine.
const PARTS: readonly Part[] = [
  {
    id: 'mending-loose-pages',
    label: 'Loose pages',
    level: 3,
    text: 'Tip a loose page back in with a thin line of paste along its inner edge, and close the book on it under a weight overnight.',
  },
  {
    id: 'mending-a-torn-page',
    label: 'A torn page',
    level: 3,
    text: 'Lay the tear on a sheet of blotting paper, ease its edges together, and bridge it with a strip of tissue and wheat starch.',
  },
  {
    id: 'mending-a-broken-spine',
    label: 'A broken spine',
    level: 3,
    text: 'A spine that has split down a joint can be mended two ways, by how much of the cover is still sound.',
  },
  {
    id: 'mending-rebacking',
    label: 'Rebacking',
    level: 4,
    text: 'Lift the old spine, line the joints with new cloth, and lay the old spine back over it, so the book keeps its own face.',
  },
  {
    id: 'mending-recasing',
    label: 'Recasing',
    level: 4,
    text: 'When the boards have come away, take the text block out, give it new mull and endpapers, and hang it back in its case.',
  },
  {
    id: 'mending-cleaning',
    label: 'Cleaning',
    level: 3,
    text: 'Brush the dust from the head of the book first, away from the spine, and lift a mark with a soft eraser, never a wet cloth.',
  },
];

export function MendingABook() {
  // The box the guide scrolls in, kept in state: null until it is on the page.
  const [box, setBox] = useState<HTMLDivElement | null>(null);

  return (
    <div className="flex w-full max-w-640 gap-16">
      <div
        ref={setBox}
        className="border-gray-6 rounded-8 h-280 min-w-0 flex-1 overflow-y-auto border-1 px-16"
      >
        {PARTS.map((part) => {
          const Heading = part.level === 4 ? 'h4' : 'h3';
          return (
            <section key={part.id} id={part.id} className="flex flex-col gap-6 py-16">
              <Heading
                className={
                  part.level === 4
                    ? 'text-13 font-600 text-gray-12'
                    : 'text-15 font-600 text-gray-12'
                }
              >
                {part.label}
              </Heading>
              <p className="text-13/19 text-gray-11">{part.text}</p>
            </section>
          );
        })}
      </div>
      <div className="w-200 shrink-0">
        <OnThisPage sections={PARTS} root={box} offset={24} label="Mending" />
      </div>
    </div>
  );
}
```

The section being read is the last whose heading has scrolled past the
line: the first before any has, and the last once the page is scrolled
to its end, since nothing after it can bring it up to the line.
`label` is the list's heading and its name for a screen reader, `On
this page` unless given.

## Beside a page

Left out, `root` is the `<main>` the list sits in, AppShell's, which
is where a page scrolls; outside a `<main>`, the window. The line is
120 pixels down unless `offset` says otherwise, a little way into the
screen, where reading starts. Below, the list sits in a sticky box
down the right of the page, so it stays in view while `<main>`
scrolls the page past it.

**A reading page**

```tsx
import { OnThisPage, Page, PageHeader, type PageSection } from '@bh/shell/layout';

interface Part extends PageSection {
  text: string;
}

const PARTS: readonly Part[] = [
  {
    id: 'light',
    label: 'Light',
    text: 'Sun fades a spine within a summer and turns paper brown at its edges. Keep the shelves out of the window’s reach, and draw a blind across them in the afternoon.',
  },
  {
    id: 'damp',
    label: 'Damp',
    text: 'Paper drinks the air. Below a third of it in water the glue cracks; above two thirds, mould comes. A room that is comfortable to sit in is right for the books.',
  },
  {
    id: 'shelving',
    label: 'Shelving',
    text: 'Stand books upright, held by their neighbours, never leaning, and lay the tall ones flat rather than let them hang from their boards.',
  },
  {
    id: 'handling',
    label: 'Handling',
    text: 'Take a book from the shelf by its middle, not by the head of its spine, and turn the pages from their corners with clean, dry hands.',
  },
  {
    id: 'dust',
    label: 'Dust',
    text: 'Dust holds damp against the pages. Brush the tops of the books twice a year, from the spine outwards, with the book held shut.',
  },
];

export function AReadingPage() {
  return (
    // AppShell's <main>, alone: the page scrolls in it, and OnThisPage finds it.
    <main className="h-dvh overflow-y-auto">
      <Page
        header={
          <PageHeader
            size="lg"
            title="Caring for old books"
            breadcrumb={[{ label: 'Guides' }]}
            description="Light, damp and hands do the harm."
          />
        }
      >
        <div className="flex flex-1">
          <article className="flex min-w-0 flex-1 flex-col gap-32 px-32 py-24">
            {PARTS.map((part) => {
              return (
                <section key={part.id} className="flex flex-col gap-8">
                  <h2 id={part.id} className="text-18/26 font-600 text-gray-12 scroll-mt-24">
                    {part.label}
                  </h2>
                  <p className="text-15/24 text-gray-12">{part.text}</p>
                </section>
              );
            })}
          </article>
          {/* Down the right edge; its list stays in view while <main> scrolls past. */}
          <aside className="border-gray-6 w-200 shrink-0 border-l-1">
            <div className="sticky top-0">
              <OnThisPage sections={PARTS} />
            </div>
          </aside>
        </div>
      </Page>
    </main>
  );
}
```

## Going to a section

A click lights its section at once, and keeps it lit until the reader
scrolls by hand, with the wheel, a touch or a key, while the page
scrolls there: a short page bottoms out before a late heading can reach
the line, and its entry still says where the reader went. Without
`onSelect`, the click scrolls `root`, and only `root`, until the
heading is at its top, short of its `scroll-margin-top`. With it, the
app goes there itself: to put the section's id in the address as well,
as the docs site does.

```tsx
import type { ReactNode } from 'react';
import { OnThisPage, Page, PageHeader, type PageSection } from '@bh/shell/layout';

/** Scrolls to a section, and puts its id in the address, keeping the router's state. */
function goTo(section: PageSection) {
  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.replaceState(history.state, '', `#${section.id}`);
}

export interface GuidePageProps {
  title: string;
  sections: readonly PageSection[];
  children: ReactNode;
}

export function GuidePage({ title, sections, children }: GuidePageProps) {
  return (
    <Page header={<PageHeader size="lg" title={title} />}>
      <div className="flex flex-1">
        <article className="min-w-0 flex-1 px-16 py-24 md:px-32 md:py-32">{children}</article>
        {/* Down the right edge on a wide screen, in view while <main> scrolls. */}
        <aside className="border-gray-6 hidden w-240 shrink-0 border-l-1 xl:block">
          <div className="sticky top-0 max-h-dvh overflow-y-auto">
            <OnThisPage sections={sections} onSelect={goTo} />
          </div>
        </aside>
      </div>
    </Page>
  );
}
```

## Keyboard and accessibility

| Key     | Does                                                       |
| ------- | ---------------------------------------------------------- |
| `Tab`   | Moves through the entries, in the order the sections come. |
| `Enter` | Goes to the focused entry's section, and lights it.        |

The list is a navigation landmark named by its heading. Each entry is a
link to its section's `#id`, and the one being read is marked
`aria-current="location"`. A section with sections under it holds them
in a list of its own, so a screen reader says how deep each is.

## Rules

- **The sections are the app's.** The list draws what it is handed, in
  that order, and reads nothing off the page but where each heading is.
- **Each `id` is a heading's**, on the page, and unique on it.
- **It draws the list, nothing around it.** The app places it, and keeps
  it in view.
- **One line for the whole page.** A section is read once its heading
  passes `offset`, whatever its level.
- **An empty list draws nothing**, so a page with no sections needs no
  condition.

## Reference

`Element` is the DOM's: the `<main>`, or a box of the app's own, that
the page scrolls in.

| Prop                  | Type                             | Default          | Description                                                                                                                                                                                               |
| --------------------- | -------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sections` (required) | `readonly PageSection[]`         |                  | The page's sections, in the order they come on it. Without any, it draws nothing.                                                                                                                         |
| `onSelect`            | `(section: PageSection) => void` |                  | Called with the section picked, after it is lit, to go to it: to scroll there and put its id in the address, say. Without it, the section's heading scrolls to the top of `root`.                         |
| `root`                | `Element \| null`                |                  | The element the page scrolls in. Left out, the `<main>` the list sits in, as AppShell's, or the window outside one. `null` while it is not known yet, as an element kept in state before its ref has run. |
| `offset`              | `number`                         | `120`            | How far below the top of `root` a section's heading has to pass to be the one being read, in pixels: 120 unless given, a line a little way down where reading starts.                                     |
| `label`               | `string`                         | `'On this page'` | The list's heading, and its name for a screen reader.                                                                                                                                                     |

```ts
interface PageSection
```

One of a page's sections, as OnThisPage lists it.

| Member             | Type     | Default | Description                                                                                                                                                      |
| ------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` (required)    | `string` |         | Its heading's element id: what the entry links to, and where it watches.                                                                                         |
| `label` (required) | `string` |         | What the entry says: the heading's text, as a rule.                                                                                                              |
| `level`            | `number` |         | Its heading's level: 2 for an `h2`, since the page's title is its `h1`. A section is listed under the nearest one before it with a lower level. 2 when left out. |
