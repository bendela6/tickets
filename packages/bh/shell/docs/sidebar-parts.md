---
title: Sidebar parts
summary: The pieces AppShell is built from, for an app that assembles a frame of
  its own.
order: 3
related: [AppShell, Navigation data]
---

[//]: # 'written from sidebar-parts.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Sidebar parts

The pieces AppShell is built from, for an app that assembles a frame of
its own.

`AppShell` is a `Sidebar` docked beside `<main>` on a wide screen, and on
a phone a `TopBar` with a `Drawer` that holds the same `Sidebar`. Each
part is exported, and so are the classes they share. An app that wants
the frame as it is uses `AppShell`, which keeps the parts in step.

## Import

```tsx
import { NavGroup, NavRow, RailNav, Sidebar, TopBar } from '@bh/shell';
```

## The sidebar

`Sidebar` draws one column in either of its states: rows about 240
pixels wide, which the reader can drag between 180 and 400, or a
48-pixel rail of icons. Both keep one rhythm, the brand row, the search,
the nav that scrolls and the footer, so collapsing moves nothing but the
labels.

It keeps its width and its open sections under `storagePrefix`, and
nothing else: whether it is collapsed and the path on screen are the
caller's to hold and pass.

**Two states**

```tsx
import { useState } from 'react';
import { BookOpen, Library, Plus, Settings, ShoppingBag, Truck } from 'lucide-react';
import { Sidebar, type NavSection } from '@bh/shell';

// Shop's action, New order, counts its orders up.
const sections = (orders: number, onNewOrder: () => void): readonly NavSection[] => {
  return [
    {
      id: 'shop',
      label: 'Shop',
      action: { label: 'New order', icon: Plus, onSelect: onNewOrder },
      items: [
        { label: 'Books', path: '/books', icon: BookOpen, count: '1,284' },
        { label: 'Orders', path: '/orders', icon: ShoppingBag, count: orders },
        { label: 'Deliveries', path: '/deliveries', icon: Truck, status: 'warn' },
      ],
    },
    {
      id: 'system',
      label: 'System',
      items: [{ label: 'Settings', path: '/settings', icon: Settings }],
    },
  ];
};

const BRAND = {
  mark: <Library size={18} strokeWidth={1.75} className="text-indigo-9" />,
  name: 'bookshop',
};

export function TwoStates() {
  // Held here and forgotten on reload; AppShell remembers it under the prefix.
  const [collapsed, setCollapsed] = useState(false);
  const [orders, setOrders] = useState(12);
  return (
    <div className="bg-gray-1 text-gray-12 flex h-dvh">
      <Sidebar
        sections={sections(orders, () => setOrders((count) => count + 1))}
        brand={BRAND}
        storagePrefix="bookshop-parts"
        currentPath="/books"
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        onExpand={() => setCollapsed(false)}
      />
      <main className="text-13/19 text-gray-11 flex-1 px-32 py-24">
        {collapsed ? 'At rail width: press the mark to expand.' : 'Expanded: about 240px.'}
      </main>
    </div>
  );
}
```

Here `currentPath` is fixed at `/books`, and `collapsed` is held in
state, so it is forgotten on a reload. `AppShell` passes the router's
path and remembers `collapsed` under `<storagePrefix>:collapsed`. A frame
of your own reads the path the same way:

```tsx
import { useState, type ReactNode } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Sidebar, type NavSection, type ShellBrand } from '@bh/shell';

interface FrameProps {
  sections: readonly NavSection[];
  brand: ShellBrand;
  children: ReactNode;
}

export function Frame({ sections, brand, children }: FrameProps) {
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="bg-gray-1 text-gray-12 flex h-dvh">
      <Sidebar
        sections={sections}
        brand={brand}
        storagePrefix="bookshop-nav"
        currentPath={currentPath}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        onExpand={() => setCollapsed(false)}
      />
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

`inDrawer` is the sidebar inside a drawer: it fills the drawer's width,
has no edge to drag, and its top row's control, named Close navigation,
calls `onToggleCollapsed` to close it.

## The parts

- **`BrandRow`**: the 44-pixel top row. Expanded, the mark, the name and
  the control that collapses the sidebar. Collapsed, the mark is the
  control that expands it, so a sidebar at rail width can always be
  opened again.
- **`NavSearch`**: the search field, or with `onSearch` the button to the
  app's search, or at rail width a search icon.
- **`NavGroup`**: one section of the expanded sidebar, its header and its
  rows. The header is a toggle and, with the section's `action`, a ghost
  icon button after it, as "New order" beside Shop above.
- **`NavRow`**: one destination, a 42-pixel link with its icon, label,
  count and dots. It runs edge to edge, so the lit fill reaches the
  sidebar's border, and its focus ring is drawn inside it.
- **`NavBranch`**: a destination with pages: its row, its chevron, and a
  `NavLeafRow` for each page, indented under the label, 32 pixels tall,
  with no icon.
- **`RailNav`**: every destination as an icon, sections split by a rule.
  `RailMenu` is a destination with pages there, whose icon opens a menu.
- **`TopBar`**: the phone's 48-pixel bar: the menu button, the brand, a
  search button with `onSearch`, and `end`.
- **`NavStatusDot`**: a status as a 6-pixel dot and words for a screen
  reader. `NAV_STATUS` holds each status's colour and words.
- **`ActiveBar`**: the 3-pixel bar on the lit row's left edge.

## The search shortcut

The shortcut has one owner at a time. Without `onSearch`, `NavSearch`
binds it, and it expands the sidebar and focuses the field. With
`onSearch`, the field leaves it alone and `AppShell` binds it, since on a
phone the field is only there while the drawer is open. A frame of your
own that passes `onSearch` binds the shortcut itself:
`isAppleShortcutPlatform` says whether it is ⌘K or Ctrl K, and
`shortcutLabel` is the hint the field shows.

## Shared classes

`NAV_STYLES` holds the classes the rows, the rail and the controls share,
so a part of your own matches them:

- **`focusRing`**: drawn inside the element, since a ring outside a row
  that runs edge to edge would be cut off.
- **`active`**: the lit row's fill and text.
- **`resting`**: a row that is not lit.
- **`control`**: a control beside the rows, like the collapse button, a
  rung quieter than a row.

`EXACT_MATCH` is the `activeOptions` a destination with pages, and each
of its pages, hands its `Link`. By default the router marks a link active
on every path under it, and the destination, its first page and the page
on screen would each say they are the page.

## Rules

- The parts draw, and the caller holds the state: whether the sidebar is
  collapsed, the path on screen, and whether the drawer is open.
- The sidebar remembers only its width (`<storagePrefix>:width`) and its
  open sections (`<storagePrefix>:group:<id>`).
- At rail width, every destination is reachable, and the mark expands
  the sidebar.
- The search shortcut has one owner: the field without `onSearch`, the
  frame with it.

## Reference

### Sidebar

| Prop                           | Type                                | Default | Description                                                                                                      |
| ------------------------------ | ----------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `sections` (required)          | `readonly NavSection[]`             |         | The app's nav, in the order it is drawn.                                                                         |
| `brand` (required)             | `ShellBrand`                        |         | The app's mark and name, in the top row.                                                                         |
| `footer`                       | `(collapsed: boolean) => ReactNode` |         | The app's footer block, told whether it is drawn at rail width.                                                  |
| `storagePrefix` (required)     | `string`                            |         | Where the width and the open groups are remembered, e.g. `myapp-nav`.                                            |
| `currentPath` (required)       | `string`                            |         | The path on screen, which lights the destination it is at or under.                                              |
| `collapsed` (required)         | `boolean`                           |         | At rail width: icons only, 48px wide.                                                                            |
| `onToggleCollapsed` (required) | `() => void`                        |         | The top row's control: collapses or expands the sidebar; in the drawer, closes it.                               |
| `onExpand` (required)          | `() => void`                        |         | Expands the sidebar, for the rail's search icon and the search shortcut.                                         |
| `onNavigate`                   | `() => void`                        |         | Called when the reader follows any destination: AppShell's drawer closes on it.                                  |
| `onSearch`                     | `() => void`                        |         | Opens the app's own search; see NavSearch.                                                                       |
| `inDrawer`                     | `boolean`                           | `false` | Inside the phone's drawer: it fills the drawer, has no drag handle, and its top row's control closes the drawer. |

### BrandRow

| Prop                   | Type         | Default | Description                                                                                         |
| ---------------------- | ------------ | ------- | --------------------------------------------------------------------------------------------------- |
| `brand` (required)     | `ShellBrand` |         | The app's mark and name.                                                                            |
| `collapsed` (required) | `boolean`    |         | At rail width: the mark alone, and it is the button that expands the sidebar.                       |
| `onToggle` (required)  | `() => void` |         | Collapses the docked sidebar; inside the drawer it shuts the drawer.                                |
| `inDrawer`             | `boolean`    | `false` | Inside the phone's drawer: the control is named Close navigation, and `onToggle` closes the drawer. |

### NavSearch

| Prop                         | Type         | Default | Description                                                                                                                               |
| ---------------------------- | ------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `collapsed` (required)       | `boolean`    |         | At rail width: a search icon in place of the field.                                                                                       |
| `onRequestExpand` (required) | `() => void` |         | Expands the sidebar. Without `onSearch`, the rail's search icon and the shortcut call it, and the field takes the focus once it is drawn. |
| `onSearch`                   | `() => void` |         | Opens the app's own search. The shortcut is then AppShell's, not this field's.                                                            |

### NavGroup

| Prop                       | Type         | Default | Description                                                                                                                                    |
| -------------------------- | ------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `section` (required)       | `NavSection` |         | The section it draws: its header, from `label`, and its rows.                                                                                  |
| `currentPath` (required)   | `string`     |         | The path on screen.                                                                                                                            |
| `storagePrefix` (required) | `string`     |         | Where the app keeps its nav state, e.g. `myapp-nav`: the open flag is `<prefix>:group:<section id>`. Two apps on one origin must not share it. |
| `onNavigate`               | `() => void` |         | Called when the reader follows any of its destinations.                                                                                        |

### NavRow

| Prop                 | Type         | Default | Description                                                                                                                                                                                                       |
| -------------------- | ------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item` (required)    | `NavItem`    |         | The destination it links to. Its `children` are not drawn here: NavBranch draws them.                                                                                                                             |
| `current` (required) | `boolean`    |         | Lit: the indigo fill and the bar on the left edge, and, unless `exact`, `aria-current`.                                                                                                                           |
| `onNavigate`         | `() => void` |         | Called when the reader follows it.                                                                                                                                                                                |
| `exact`              | `boolean`    | `false` | Match its page exactly (EXACT_MATCH): for a destination with pages of its own, which is lit while any of them is on screen but is only "the page" when it is the page itself. The mark then follows the router's. |
| `atPage`             | `boolean`    | `false` | With `exact`: whether the row's own page is the one on screen.                                                                                                                                                    |
| `endGap`             | `boolean`    | `false` | Room at the end for a control drawn over the row, e.g. its chevron.                                                                                                                                               |

### NavBranch

| Prop                     | Type                                         | Default | Description                                                         |
| ------------------------ | -------------------------------------------- | ------- | ------------------------------------------------------------------- |
| `item` (required)        | `NavItem & { children: readonly NavLeaf[] }` |         | The destination, with at least one page.                            |
| `currentPath` (required) | `string`                                     |         | The path on screen.                                                 |
| `onNavigate`             | `() => void`                                 |         | Called when the reader follows the destination or one of its pages. |

### NavLeafRow

| Prop                 | Type         | Default | Description                                                              |
| -------------------- | ------------ | ------- | ------------------------------------------------------------------------ |
| `leaf` (required)    | `NavLeaf`    |         | The page it links to.                                                    |
| `current` (required) | `boolean`    |         | Lit: the page on screen, or the page it sits under (currentLeaf).        |
| `atPage` (required)  | `boolean`    |         | Its own page is the one on screen — what the router marks (EXACT_MATCH). |
| `onNavigate`         | `() => void` |         | Called when the reader follows it.                                       |

### RailNav

| Prop                     | Type                    | Default | Description                                                              |
| ------------------------ | ----------------------- | ------- | ------------------------------------------------------------------------ |
| `sections` (required)    | `readonly NavSection[]` |         | The app's nav: every destination of every section, shut groups included. |
| `currentPath` (required) | `string`                |         | The path on screen.                                                      |
| `onNavigate`             | `() => void`            |         | Called when the reader follows any destination.                          |

### RailMenu

| Prop                     | Type                                         | Default | Description                                    |
| ------------------------ | -------------------------------------------- | ------- | ---------------------------------------------- |
| `item` (required)        | `NavItem & { children: readonly NavLeaf[] }` |         | The destination, with at least one page.       |
| `currentPath` (required) | `string`                                     |         | The path on screen.                            |
| `onNavigate`             | `() => void`                                 |         | Called when the reader picks one of its pages. |

### TopBar

| Prop                   | Type         | Default | Description                                                                     |
| ---------------------- | ------------ | ------- | ------------------------------------------------------------------------------- |
| `brand` (required)     | `ShellBrand` |         | The app's mark and name, after the menu button.                                 |
| `onOpenNav` (required) | `() => void` |         | The menu button's action: opens the drawer that holds the sidebar.              |
| `onSearch`             | `() => void` |         | Given, a search button sits before `end`: on a phone there is no sidebar field. |
| `end`                  | `ReactNode`  |         | At the far end of the bar: what the rail would otherwise show, like a status.   |

### NavStatusDot

| Prop                | Type                                                 | Default | Description                                                                 |
| ------------------- | ---------------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| `status` (required) | `NavStatus`: `'up'`, `'warn'`, `'down'`, `'unknown'` |         | Which of the four: its tone and its words come from NAV_STATUS.             |
| `className`         | `string`                                             |         | Classes on the wrapper, to place it: the rail sets it on the icon's corner. |

### Values and helpers

```ts
ActiveBar(): Element
```

The active row's edge indicator, positioned against a `relative` row.

Returns `Element`.

```ts
const NAV_STYLES: {
  readonly focusRing: string;
  readonly active: 'bg-indigo-3 text-indigo-11';
  readonly resting: 'text-gray-11 hover:bg-surface-inset hover:text-gray-12';
  readonly control: 'text-gray-10 hover:bg-surface-inset hover:text-gray-12';
};
```

The classes the sidebar's rows, rail icons and small controls share:
`focusRing` (inset), `active` (the lit row), `resting` (a row), and
`control` (a control beside the rows, a rung quieter).

```ts
const NAV_STATUS: Record<NavStatus, { tone: string; label: string }>;
```

Each status's dot class and its words: `up` green, "Up"; `warn` orange,
"Up, with warnings"; `down` red, "Down"; `unknown` gray, "Not checked yet".

```ts
const EXACT_MATCH: { readonly exact: true; readonly includeSearch: false };
```

The `activeOptions` a destination with pages, and each of its pages, gives
its `Link`: active on its own path only, whatever the search string, so the
router marks the page on screen and no other.

```ts
isAppleShortcutPlatform(): boolean
```

True on Apple platforms, where the search shortcut is ⌘K rather than Ctrl K.

Returns `boolean`.

```ts
shortcutLabel(): string
```

The label for the search shortcut on this platform.

Returns `string`.
