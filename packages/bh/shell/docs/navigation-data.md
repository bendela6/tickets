---
title: Navigation data
summary: Describe the app's nav as sections of destinations, with counts, dots,
  statuses and pages of their own.
order: 2
related: [AppShell, Sidebar parts]
---

[//]: # 'written from navigation-data.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Navigation data

Describe the app's nav as sections of destinations, with counts, dots,
statuses and pages of their own.

The list is the app's. The package only says what a section and a
destination are, and draws each one twice: as a row in the expanded
sidebar, and as an icon in the rail.

## Import

```tsx
import type { NavItem, NavLeaf, NavSection, NavSectionAction, NavStatus } from '@bh/shell';
```

## Sections and destinations

`sections` is a list of `NavSection`s, drawn in order. A section has:

- **`id`**: a stable key. Whether the section is open is remembered under
  `<storagePrefix>:group:<id>`, so its label is free to change.
- **`label`**: its header, which opens and shuts it. Shut, the header
  shows how many rows it hides. The leading section can leave it out: its
  rows sit above the first header, with nothing to toggle.
- **`action`**: a button at the right of the header, as `+` for "New
  arrival" beside Collection below: a `label`, which names it and is its
  tooltip, an `icon` from `lucide-react`, and `onSelect`. Pressing it
  leaves the section open or shut. The leading section has no header to
  carry one, and the rail shows none.
- **`items`**: its destinations, each a `NavItem`.

A destination has a `label`, a `path`, and an `icon` from `lucide-react`.
It may also carry:

- **`count`**: a number or a string at the end of its row, as `18,402`.
- **`dot`**: a red dot, for something that wants attention.
- **`status`**: `up`, `warn`, `down` or `unknown`, drawn as a still dot in
  green, orange, red or gray, and said in words to a screen reader: "Up",
  "Up, with warnings", "Down", "Not checked yet".
- **`children`**: pages of its own, each a `NavLeaf` with a `label`, a
  `path` and a `count` of its own.

A screen reader reads a row's label, count and status apart, "Orders,
12" or "Status, Up, with warnings", from the row's own `aria-label`.

**A library**

```tsx
import {
  ArrowLeftRight,
  BookOpen,
  Landmark,
  LayoutDashboard,
  Plus,
  Printer,
  ScanBarcode,
  Search,
  Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { AppShell, type NavSection } from '@bh/shell';

// Collection's action, New arrival, counts one in; what it does is the app's to say.
const sections = (arrivals: number, onNewArrival: () => void): readonly NavSection[] => {
  return [
    { id: 'start', items: [{ label: 'Overview', path: '/', icon: LayoutDashboard }] },
    {
      id: 'collection',
      label: 'Collection',
      action: { label: 'New arrival', icon: Plus, onSelect: onNewArrival },
      items: [
        {
          label: 'Catalogue',
          path: '/catalogue',
          icon: BookOpen,
          count: '18,402',
          children: [
            { label: 'All titles', path: '/catalogue' },
            { label: 'New arrivals', path: '/catalogue/new', count: arrivals },
            { label: 'Withdrawn', path: '/catalogue/withdrawn' },
          ],
        },
        { label: 'Loans', path: '/loans', icon: ArrowLeftRight, count: 214, dot: true },
      ],
    },
    {
      id: 'services',
      label: 'Services',
      items: [
        { label: 'Catalogue search', path: '/services/search', icon: Search, status: 'up' },
        { label: 'Self-checkout', path: '/services/checkout', icon: ScanBarcode, status: 'warn' },
        { label: 'Printing', path: '/services/printing', icon: Printer, status: 'down' },
        { label: 'Wi-Fi', path: '/services/wifi', icon: Wifi, status: 'unknown' },
      ],
    },
  ];
};

const BRAND = {
  mark: <Landmark size={18} strokeWidth={1.75} className="text-indigo-9" />,
  name: 'library',
};

export function ALibrary() {
  const [arrivals, setArrivals] = useState(36);
  return (
    <AppShell
      sections={sections(arrivals, () => setArrivals((count) => count + 1))}
      brand={BRAND}
      storagePrefix="library-nav"
    >
      <p className="text-13/19 text-gray-11 px-16 py-16 md:px-32 md:py-24">
        Open Catalogue, then collapse the sidebar and open its icon. The + beside Collection counts
        a new arrival in.
      </p>
    </AppShell>
  );
}
```

## Which destination is lit

A destination is lit while the path on screen is its path or under it:
`/books` is lit on `/books` and on `/books/42`, but not on `/bookshops`.
`/` is lit on `/` alone, or it would be lit on every page. The lit row
takes an indigo fill and a bar on its left edge, in the rows and the
rail alike, and its link says `aria-current="page"`. `isCurrentPath` is
the test.

## Destinations with pages

A destination with `children` opens to show its pages under it. It opens
by itself while one of them is on screen, and shuts when the reader
leaves. Its chevron opens or shuts it by hand without navigating, and
that choice stands until the reader moves in or out of it.

Exactly one page is lit: of the pages the path on screen is at or under,
the one with the longest path (`currentLeaf`). So a first page can share
the destination's path, as All titles does at `/catalogue`, beside New
arrivals at `/catalogue/new`. The destination's own row stays lit while
any of its pages is on screen, but `aria-current` is on the page's link
alone.

## At rail width

Collapsed, every destination is an icon, named by a tooltip, with a short
rule between sections. A section shut in the expanded sidebar still shows
all its icons, since the rail has no headers to open it by. A status sits
on the icon's corner, and so does the attention dot of a destination
without pages.

A destination with pages opens a menu of them, headed by its label, and
picking one goes there. The menu lists the pages' labels, without their
counts.

| Key                | Does                                                     |
| ------------------ | -------------------------------------------------------- |
| `Enter` or `Space` | On the icon of a destination with pages, opens its menu. |
| `↑` or `↓`         | Moves through the menu's pages.                          |
| `Enter`            | Goes to the page.                                        |
| `Esc`              | Closes the menu.                                         |

## Rules

- A destination is lit on its path and on every path under it; `/` on
  itself alone.
- Of a destination's pages, one is lit: the longest path that matches.
- Every destination is reachable at rail width, in a shut section or
  behind a menu.
- A section's open state is kept under its `id`: a new id forgets it, a
  new label does not.
- The status dot never moves: a pulsing dot on every row would set the
  whole sidebar moving.

## Reference

```ts
interface NavSection
```

A group of destinations under one header; in the rail, a run of icons between rules.

| Member             | Type                 | Default | Description                                                                                                                                                                     |
| ------------------ | -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` (required)    | `string`             |         | Stable key for the section's collapsed state; the label is free to change.                                                                                                      |
| `label`            | `string`             |         | Omitted for the leading section, whose rows sit above the first header.                                                                                                         |
| `action`           | `NavSectionAction`   |         | A button at the right of the header, in the expanded sidebar and the phone's drawer. The leading section has no header to carry one, and the rail, with no headers, shows none. |
| `items` (required) | `readonly NavItem[]` |         | Its destinations, in the order they are drawn.                                                                                                                                  |

```ts
interface NavSectionAction
```

A button at the right of a section's header, e.g. "New project" beside Projects.

| Member                | Type         | Default | Description                                                |
| --------------------- | ------------ | ------- | ---------------------------------------------------------- |
| `label` (required)    | `string`     |         | The button's accessible name, and its tooltip.             |
| `icon` (required)     | `LucideIcon` |         | A lucide icon, the button's only content.                  |
| `onSelect` (required) | `() => void` |         | Called when it is pressed; the section stays open or shut. |

```ts
interface NavItem
```

One destination in the sidebar's rows and in its rail.

| Member             | Type                                                 | Default | Description                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label` (required) | `string`                                             |         | The row's label, and the rail icon's name and tooltip.                                                                                                                                                                    |
| `path` (required)  | `string`                                             |         | Where it links. Lit while the path on screen is this one or under it; `/` only when exact.                                                                                                                                |
| `icon` (required)  | `LucideIcon`                                         |         | A lucide icon, drawn at 18px on the row and in the rail.                                                                                                                                                                  |
| `count`            | `string \| number`                                   |         | Trailing badge — a total for the destination, e.g. `1,284`.                                                                                                                                                               |
| `dot`              | `boolean`                                            |         | Trailing attention dot, e.g. a destination with something failing.                                                                                                                                                        |
| `status`           | `NavStatus`: `'up'`, `'warn'`, `'down'`, `'unknown'` |         | A four-tone status dot, trailing on the row and on the rail's icon.                                                                                                                                                       |
| `children`         | `readonly NavLeaf[]`                                 |         | The destination's own pages. With them the row opens to show them — by itself while one of them is on screen, by its chevron otherwise — and the rail's icon opens a menu of them, so every page stays reachable at 48px. |

```ts
interface NavLeaf
```

A page under a destination: a row in the expanded sidebar, an entry in the rail's menu.

| Member             | Type               | Default | Description                                                                             |
| ------------------ | ------------------ | ------- | --------------------------------------------------------------------------------------- |
| `label` (required) | `string`           |         | The page's name in the row and in the menu.                                             |
| `path` (required)  | `string`           |         | Where it links. When several of the pages match the path on screen, the longest is lit. |
| `count`            | `string \| number` |         | Trailing badge on its row in the expanded sidebar; the rail's menu shows none.          |

```ts
type NavStatus = 'up' | 'warn' | 'down' | 'unknown';
```

How a destination is doing, when the app knows: up, up with something worth
reading, down, or not asked yet. The nav draws it as a dot in one of four
tones and says it in words to a screen reader; what it is the status OF is
the app's business.

One of `'up'`, `'warn'`, `'down'`, `'unknown'`.

```ts
isCurrentPath(path: string, currentPath: string): boolean
```

True when a nav path is the current route or one of its descendants.

`/` is matched exactly: as a prefix it is a prefix of every route, which
would leave the first destination lit on every page.

| Parameter                | Type     | Default | Description                                     |
| ------------------------ | -------- | ------- | ----------------------------------------------- |
| `path` (required)        | `string` |         | A destination's path, as the nav data gives it. |
| `currentPath` (required) | `string` |         | The path on screen.                             |

Returns `boolean`.

```ts
currentLeaf(leaves: readonly NavLeaf[], currentPath: string): string | undefined
```

The path of the page on screen, or undefined when none of them is.

Of the pages the path on screen is at or under, the longest path wins.

| Parameter                | Type                 | Default | Description            |
| ------------------------ | -------------------- | ------- | ---------------------- |
| `leaves` (required)      | `readonly NavLeaf[]` |         | A destination's pages. |
| `currentPath` (required) | `string`             |         | The path on screen.    |

Returns `string \| undefined`.
