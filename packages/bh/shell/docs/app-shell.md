---
title: AppShell
summary: 'Put every page of an app in one frame: a sidebar of its nav, a top bar
  and a drawer on a phone, and its search.'
order: 1
related: [Navigation data, Sidebar parts, Theme, Pages, The app names its own]
---

[//]: # 'written from app-shell.doc.yaml by pnpm docs:sync; edit that file, not this one'

# AppShell

Put every page of an app in one frame: a sidebar of its nav, a top bar
and a drawer on a phone, and its search.

`@bh/shell` draws the frame and knows nothing of the app inside it. The
app hands in what is its own: the nav as data, its name and mark, its
footer, and the keys it remembers things under.

## Import

```tsx
import { AppShell, ThemeFooter, type NavSection } from '@bh/shell';
import { Page, PageHeader } from '@bh/shell/layout';
```

The shell's classes are written in the package, outside what the app's
Tailwind scans, so the app's stylesheet imports `@bh/shell/styles.css`
after `@bh/ui`'s tokens. Without it the frame draws with no styles.
[Styles and fonts](../../../../apps/docs/content/getting-started/styles-and-fonts.md) has the rest.

```css
@import '@bh/ui/tokens.css';
@import '@bh/shell/styles.css';
```

## A whole app

`AppShell` takes the nav as `sections`, the app's `brand` (a `mark` and a
`name`), a `storagePrefix`, an optional `footer`, and the page as its
children. The footer is a function told whether the sidebar is at rail
width; [`ThemeFooter`](theme.md#in-the-footer) is a ready one.

**A bookshop**

```tsx
import { BookOpen, House, Library, Settings, ShoppingBag, Truck, Users } from 'lucide-react';
import { AppShell, ThemeFooter, type NavSection } from '@bh/shell';
import { Page, PageBody, PageHeader } from '@bh/shell/layout';
import { Button } from '@bh/ui';

const SECTIONS: readonly NavSection[] = [
  { id: 'home', items: [{ label: 'Home', path: '/', icon: House }] },
  {
    id: 'shop',
    label: 'Shop',
    items: [
      { label: 'Books', path: '/books', icon: BookOpen, count: '1,284' },
      { label: 'Orders', path: '/orders', icon: ShoppingBag, count: 12, dot: true },
      { label: 'Deliveries', path: '/deliveries', icon: Truck },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

const BRAND = {
  mark: <Library size={18} strokeWidth={1.75} className="text-indigo-9" />,
  name: 'bookshop',
};

export function ABookshop() {
  return (
    <AppShell
      sections={SECTIONS}
      brand={BRAND}
      storagePrefix="bookshop-nav"
      footer={(collapsed) => <ThemeFooter collapsed={collapsed} storageKey="bookshop-theme" />}
    >
      <Page
        header={
          <PageHeader
            title="Good morning"
            description="Twelve orders came in overnight."
            actions={<Button variant="solid">New order</Button>}
          />
        }
      >
        <PageBody>
          <p className="text-13/19 text-gray-11">
            Follow the links in the sidebar, collapse it, or drag its edge.
          </p>
        </PageBody>
      </Page>
    </AppShell>
  );
}
```

On a wide screen the sidebar is docked beside the page. It starts 240
pixels wide, and the reader can drag its right edge between 180 and 400.
The control at the end of its top row collapses it to a 48-pixel rail of
icons, and the mark expands it again. The page scrolls in the `<main>`
beside it, never the document.

The links here move the example's own history, so the sidebar follows
them while the page under it stays the same. In an app, `AppShell` reads
the path on screen from TanStack Router, so it sits in the root route,
around the `Outlet`:

```tsx
import { Outlet } from '@tanstack/react-router';
import { BookOpen, Library } from 'lucide-react';
import { AppShell, ThemeFooter, type NavSection } from '@bh/shell';
import { TooltipProvider } from '@bh/ui';

// Named after the app: every app on localhost shares one origin in development.
const NAV_STORAGE_PREFIX = 'bookshop-nav';
const THEME_STORAGE_KEY = 'bookshop-theme';

const NAV: readonly NavSection[] = [
  { id: 'shop', label: 'Shop', items: [{ label: 'Books', path: '/books', icon: BookOpen }] },
];

const BRAND = { mark: <Library size={18} strokeWidth={1.75} />, name: 'bookshop' };

export function Root() {
  return (
    <TooltipProvider>
      <AppShell
        sections={NAV}
        brand={BRAND}
        storagePrefix={NAV_STORAGE_PREFIX}
        footer={(collapsed) => <ThemeFooter collapsed={collapsed} storageKey={THEME_STORAGE_KEY} />}
      >
        <Outlet />
      </AppShell>
    </TooltipProvider>
  );
}
```

## On a phone

Below 768 pixels, the `md` breakpoint, the sidebar leaves the page. A
48-pixel top bar takes its place: the menu button, the brand, and
`topBarEnd` at its far end, for what the rail would otherwise show. The
menu button opens a drawer from the left that holds the same sidebar,
always expanded. Its top row's control closes it, and so does following
any destination.

**A garden**

```tsx
import { CalendarDays, Droplets, Flower2, Leaf, Sprout, Sun, Warehouse } from 'lucide-react';
import { AppShell, ThemeFooter, type NavSection } from '@bh/shell';
import { Page, PageBody, PageHeader } from '@bh/shell/layout';
import { Pill } from '@bh/ui';

const SECTIONS: readonly NavSection[] = [
  { id: 'today', items: [{ label: 'Today', path: '/', icon: Sun }] },
  {
    id: 'garden',
    label: 'Garden',
    items: [
      { label: 'Beds', path: '/beds', icon: Sprout, count: 8 },
      { label: 'Watering', path: '/watering', icon: Droplets, dot: true },
      { label: 'Harvest', path: '/harvest', icon: Leaf },
    ],
  },
  {
    id: 'plan',
    label: 'Plan',
    items: [
      { label: 'Calendar', path: '/calendar', icon: CalendarDays },
      { label: 'Shed', path: '/shed', icon: Warehouse },
    ],
  },
];

const BRAND = {
  mark: <Flower2 size={18} strokeWidth={1.75} className="text-green-9" />,
  name: 'garden',
};

export function AGarden() {
  return (
    <AppShell
      sections={SECTIONS}
      brand={BRAND}
      storagePrefix="garden-nav"
      footer={(collapsed) => <ThemeFooter collapsed={collapsed} storageKey="garden-theme" />}
      topBarEnd={<Pill tone="blue" label="Frost tonight" />}
    >
      <Page header={<PageHeader title="Today" description="Three beds want water." />}>
        <PageBody>
          <p className="text-13/19 text-gray-11">
            Open the menu for the sidebar, and pick a destination to close it again.
          </p>
        </PageBody>
      </Page>
    </AppShell>
  );
}
```

The switch is made in code rather than by a class, so a phone turned
wide with the drawer open is left with no dim and no trapped focus: the
drawer shuts as the window widens, and stays shut when it narrows again.
The frame is as tall as the screen shows (`h-dvh`), so a phone's address
bar never makes the page scroll twice.

A page's [SidePanel](../../ui/src/library/overlays/components/side-panel/side-panel.md) below its
`overlayBelow` is shut, and the button that opens it sits at the top of
the panel's place in the page, under the page's header, not over the top
bar's menu button.

**A page with a side panel**

```tsx
import { Flower2, Sprout, Sun } from 'lucide-react';
import { AppShell, type NavSection } from '@bh/shell';
import { Page, PageBody, PageHeader } from '@bh/shell/layout';
import { SidePanel } from '@bh/ui';

const SECTIONS: readonly NavSection[] = [
  { id: 'today', items: [{ label: 'Today', path: '/', icon: Sun }] },
  { id: 'garden', label: 'Garden', items: [{ label: 'Beds', path: '/beds', icon: Sprout }] },
];

const BRAND = {
  mark: <Flower2 size={18} strokeWidth={1.75} className="text-green-9" />,
  name: 'garden',
};

export function APageWithASidePanel() {
  return (
    <AppShell sections={SECTIONS} brand={BRAND} storagePrefix="garden-panel-nav">
      <Page header={<PageHeader title="Beds" description="Eight beds, by where they are." />}>
        <div className="flex min-h-0 flex-1">
          <SidePanel label="Beds" collapsible overlayBelow="md">
            <div className="text-13/19 flex flex-col gap-4 p-12">
              <span>By the wall</span>
              <span>By the pond</span>
              <span>Under the apple tree</span>
            </div>
          </SidePanel>
          <PageBody className="flex-1 pt-64">
            <p className="text-13/19 text-gray-11">
              The bed the panel picks. On a phone the panel is shut, and its button sits at the top
              of its place, under the page's header and clear of the top bar.
            </p>
          </PageBody>
        </div>
      </Page>
    </AppShell>
  );
}
```

## Search

The sidebar's second row is a search field. Without `onSearch` it is a
plain field: Ctrl K (⌘K on Apple platforms) focuses it from anywhere,
expanding the rail first, and Escape clears it. It shows no results: the
package has nothing to search, and a dropdown with nothing behind it
would make matches up.

An app with a search of its own, a dialog or a page, passes `onSearch`.
The field becomes a button that calls it, the rail's search icon calls it
without expanding the rail, the phone's top bar gets a search button, and
the shortcut calls it from anywhere. From inside the drawer, the drawer
shuts first, so the search does not open under it.

[`SearchDialog`](search-dialog.md) is a ready dialog over a search
the app passes in. Here `onSearch` opens it, and a pick names the page.

**A search of its own**

```tsx
import { useState } from 'react';
import { BookOpen, House, Library, ShoppingBag, Truck } from 'lucide-react';
import { AppShell, SearchDialog, type NavSection, type SearchResult } from '@bh/shell';
import { Page, PageBody, PageHeader } from '@bh/shell/layout';

const SECTIONS: readonly NavSection[] = [
  { id: 'home', items: [{ label: 'Home', path: '/', icon: House }] },
  {
    id: 'shop',
    label: 'Shop',
    items: [
      { label: 'Books', path: '/books', icon: BookOpen },
      { label: 'Orders', path: '/orders', icon: ShoppingBag },
      { label: 'Deliveries', path: '/deliveries', icon: Truck },
    ],
  },
];

const BRAND = {
  mark: <Library size={18} strokeWidth={1.75} className="text-indigo-9" />,
  name: 'bookshop',
};

const BOOKS: readonly SearchResult[] = [
  'Middlemarch',
  'Moby-Dick',
  'Mrs Dalloway',
  'Persuasion',
  'The Leopard',
].map((title) => ({ id: title, label: title, icon: BookOpen }));

export function ASearchOfItsOwn() {
  const [searching, setSearching] = useState(false);
  const [opened, setOpened] = useState('Home');
  return (
    <>
      <AppShell
        sections={SECTIONS}
        brand={BRAND}
        storagePrefix="bookshop-nav"
        onSearch={() => setSearching(true)}
      >
        <Page header={<PageHeader title={opened} />}>
          <PageBody>
            <p className="text-13/19 text-gray-11">
              Press the search field, or Ctrl K (⌘K on a Mac).
            </p>
          </PageBody>
        </Page>
      </AppShell>
      <SearchDialog
        open={searching}
        onOpenChange={setSearching}
        search={(query) => {
          return BOOKS.filter((book) => book.label.toLowerCase().includes(query.toLowerCase()));
        }}
        onSelect={(book) => setOpened(book.label)}
        label="Search the shop"
      />
    </>
  );
}
```

| Key              | Does                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------ |
| `Ctrl+K` or `⌘K` | Calls `onSearch`. Without it, focuses the sidebar's field, expanding the rail first. |
| `Esc`            | In the sidebar's field, clears it and leaves it.                                     |
| `←` or `→`       | On the sidebar's right edge, narrows or widens it by 24 pixels.                      |

## What it remembers

Everything the frame remembers is kept in `localStorage` under the
`storagePrefix` the app passed:

| Key                   | What                                       |
| --------------------- | ------------------------------------------ |
| `<prefix>:collapsed`  | Whether the sidebar is at rail width       |
| `<prefix>:width`      | The sidebar's width, as the reader left it |
| `<prefix>:group:<id>` | Whether a section is open                  |

Name the prefix after the app, `bookshop-nav`. Every app on `localhost`
shares one origin in development, and two apps under one prefix would
share one sidebar. [The app names its own](../../../../apps/docs/content/getting-started/app-names-its-own.md)
lists every key bh keeps.

## Rules

- **No app words.** The package names nothing from the apps it frames:
  `domain-free.test.ts` fails on any in its code. The app hands its
  meaning in: the nav, the brand, the footer.
- **No data.** No fetching and no app state; only the frame's own: the
  sidebar's width, whether it is collapsed, which sections are open, and
  the theme.
- **No storage key of its own.** Everything remembered lives under the
  `storagePrefix` or theme key the app passed.
- **One router.** The frame and its nav read TanStack Router, a peer
  with `react`, `react-dom`, `lucide-react` and `tailwindcss`. The app
  resolves one copy: with two, every link in the frame fails at run time.
- **A `TooltipProvider` above it.** The rail names its icons in tooltips,
  which need `@bh/ui`'s provider.
- **The page scrolls in `<main>`.** The frame is the window's height,
  and only the page beside the sidebar scrolls.

## Reference

| Prop                       | Type                                | Default | Description                                                                                                                                                                                                             |
| -------------------------- | ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sections` (required)      | `readonly NavSection[]`             |         | The app's nav, in the order it is drawn.                                                                                                                                                                                |
| `brand` (required)         | `ShellBrand`                        |         | The mark and the name at the top of the sidebar, and in the phone's top bar.                                                                                                                                            |
| `footer`                   | `(collapsed: boolean) => ReactNode` |         | The app's footer block (an account menu, a deployment line), told whether it is at rail width.                                                                                                                          |
| `topBarEnd`                | `ReactNode`                         |         | Drawn at the far end of the phone's top bar.                                                                                                                                                                            |
| `onSearch`                 | `() => void`                        |         | Opens the app's own search (a dialog, a page). Given, the sidebar's field becomes the button to it, the phone's bar gets a search button, and ⌘K / Ctrl K calls it from anywhere. Left out, the field is a plain field. |
| `storagePrefix` (required) | `string`                            |         | Where the collapsed flag, the width and the open groups are remembered, e.g. `myapp-nav`. Two apps on one origin must not share it.                                                                                     |
| `children` (required)      | `ReactNode`                         |         | The page on screen, drawn in the `<main>` beside the sidebar, which scrolls.                                                                                                                                            |

```ts
interface ShellBrand
```

The app's mark and name, drawn at the top of its sidebar and in its phone's top bar.

| Member            | Type        | Default | Description                                                      |
| ----------------- | ----------- | ------- | ---------------------------------------------------------------- |
| `mark` (required) | `ReactNode` |         | The mark, about 18px, already coloured the way the app wants it. |
| `name` (required) | `string`    |         | The wordmark beside it, set in the mono face.                    |
