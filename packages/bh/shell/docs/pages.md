---
title: Pages
summary: Frame a page with Page and PageHeader, lay its body out in a PageBody
  or a CardGrid, and give it tabs that are routes.
order: 5
related: [AppShell, Card, SectionHeader, Tabs]
---

[//]: # 'written from pages.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Pages

Frame a page with `Page` and `PageHeader`, lay its body out in a
`PageBody` or a `CardGrid`, and give it tabs that are routes.

They come from `@bh/shell/layout`, and go in `AppShell`'s `<main>`: one
`Page` for each routed screen, so every page of an app has the same band
at its top and the same gutters.

## Import

```tsx
import {
  CardGrid,
  Page,
  PageBody,
  PageHeader,
  Section,
  TabbedPage,
  TabNav,
} from '@bh/shell/layout';
```

## A page

`Page` stacks its `header` over its body and adds nothing else. It has no
padding, and no scroll of its own: the whole page, header included,
scrolls in the shell's `<main>`, which is what lets a table's sticky
header pin to the window rather than to a box inside it. The body is a
`PageBody` or a `CardGrid`, which add the gutters, lined up with the
header's.

`PageHeader` is the band at the top, and its title is the page's `h1`.
Over the title, `breadcrumb` lists the steps above the page: a step with a
`path` links there, and one without, like a section of the nav, is a
label. `backRoute` puts a Back button before the title. `actions` sit at
the end of the title's line, and `summary` under it holds what the page
is read for at a glance.

**Shelves**

```tsx
import { CardGrid, Page, PageHeader, Section } from '@bh/shell/layout';
import { Button, Card, Pill } from '@bh/ui';

const SHELVES = [
  { name: 'Fiction', room: 'Front room', books: 412, low: false },
  { name: 'Poetry', room: 'Front room', books: 96, low: true },
  { name: 'Travel', room: 'Back room', books: 158, low: false },
  { name: 'Cookery', room: 'Back room', books: 74, low: true },
];

export function Shelves() {
  return (
    <Page
      header={
        <PageHeader
          title="Shelves"
          description="Where every book in the shop sits."
          breadcrumb={[{ label: 'Shop' }, { label: 'Books', path: '/books' }]}
          backRoute={{ to: '/books' }}
          actions={
            <>
              <Button>Export</Button>
              <Button variant="solid">New shelf</Button>
            </>
          }
          summary={<p className="text-13 text-gray-11">4 shelves, 740 books, 2 running low</p>}
        />
      }
    >
      <CardGrid>
        {SHELVES.map((shelf) => {
          return (
            <Card key={shelf.name} padding={4}>
              <Section
                title={shelf.name}
                count={shelf.books}
                action={shelf.low ? <Pill tone="orange" label="Running low" /> : null}
              >
                <p className="text-13/19 text-gray-11">{shelf.room}</p>
              </Section>
            </Card>
          );
        })}
      </CardGrid>
    </Page>
  );
}
```

At a phone's width the gutters halve, and the actions drop under the
title rather than squeeze it: the title keeps at least 180 pixels.

## A reading page

`size` is `md` by default, a working screen's header: a 20-pixel title
that keeps to one line and truncates beside its actions. `lg` is a
reading page's: a larger title that wraps, and the description set as a
lede, at most 720 pixels wide. `description` takes rich text.

`contentClassName` styles the block inside the band: `mx-auto max-w-720`
centres the header over a centred column, while the band and its rule
still run the full width. `className` styles the band itself, and
`divider={false}` drops the rule.

**Caring for old books**

```tsx
import { Page, PageBody, PageHeader } from '@bh/shell/layout';

export function CaringForOldBooks() {
  return (
    <Page
      header={
        <PageHeader
          size="lg"
          title="Caring for old books"
          description={
            <>
              Light, damp and hands do the harm. Each shelf keeps its own <code>humidity</code>{' '}
              reading.
            </>
          }
          breadcrumb={[{ label: 'Guides' }]}
          contentClassName="mx-auto max-w-720"
        />
      }
    >
      <PageBody>
        <div className="text-15/24 text-gray-12 mx-auto flex w-full max-w-720 flex-col gap-12">
          <p>Keep them out of the sun, which fades a spine within a summer.</p>
          <p>Shelve them upright, held by their neighbours, never leaning.</p>
        </div>
      </PageBody>
    </Page>
  );
}
```

## The body

`PageBody` is a page's body: its content in a column, 16 pixels apart, in
the page's gutters, 16 pixels on a phone and 32 across and 24 down from
`md`, the same across as the header's. It runs the full width of the
page, with no cap: what must not, a form's field or a column of prose,
sets its own width. `className` adds to its classes and wins over them:
`flex-1` for a body that fills the rest of the page's height.

`Section` is a titled block in a body: an uppercase caption, a `count`
beside it, an `action` at its end, and the content 8 pixels under it. The
caption is an `h2`, so a screen reader can list the page's sections.

**A page body**

```tsx
import { Page, PageBody, PageHeader, Section } from '@bh/shell/layout';
import { Button, Card, Figure, Figures } from '@bh/ui';

export function APageBody() {
  return (
    <Page
      header={
        <PageHeader
          title="Front room"
          description="Its shelves, and what they hold."
          breadcrumb={[{ label: 'Rooms', path: '/rooms' }]}
        />
      }
    >
      <PageBody>
        <Section
          title="Shelves"
          count={3}
          action={
            <Button size="sm" variant="ghost">
              Add shelf
            </Button>
          }
        >
          <Card padding={4}>
            <Figures>
              <Figure label="Fiction" note="by author, then title" value="412" />
              <Figure label="Poetry" note="running low" value="96" />
              <Figure label="Travel" note="by country" value="158" />
            </Figures>
          </Card>
        </Section>
        <Section title="Notes">
          <p className="text-13/19 text-gray-11">
            The body runs the width of the page, in the header&apos;s gutters, its sections 16
            pixels apart.
          </p>
        </Section>
      </PageBody>
    </Page>
  );
}
```

`CardGrid` is the body of a page of cards: one column on a phone and two
from `md`, 16 pixels apart, in the same gutters as `PageBody`, so a page
of cards lines up with every other. The shelves at the top of this page
are one. A card that needs both columns sits in a `md:col-span-2` box.

Which to use:

- **A page of cards**, an overview or a dashboard: `CardGrid`.
- **Anything else**: `PageBody`. Sections, a form, a single card, a
  table, a page of prose.
- **A table** sits inside the `PageBody`, in its gutters like any other
  content, never edge to edge; a filter row over it goes in the same
  body. A wide table scrolls sideways itself rather than widen the
  page, and its sticky header still pins to the window, since the body
  has no scroll of its own.
- **Cards and something else** on one page: a `PageBody`, with the cards
  in a grid of their own inside it.

## Tabs that are routes

`TabNav` is a row of tabs, each a route. A tab's `to` is a route pattern,
and `params` fill its `$name` placeholders, URL-encoded. A placeholder
with no value stays as it is, so a missing param shows in the address.
Picking a tab navigates to it. Handed to `PageHeader` as `tabs`, the row
sits on the band's rule.

The active tab is the one whose path is the longest that the path on
screen is at or under, so a tab at the page's own path gives way to the
tab under it: below, Details is `/books/42`, and on `/books/42/copies`,
or anything under it, Copies is lit and Details is not. A trailing slash
is read as none. When the path is under no tab, none is lit: a page
beside the tabs, such as one item open next to a row of views, doesn't
light the first view. The demos below open at `/`, under none of their
tabs, so nothing is lit until you pick one.

A tab's `badge` sits beside its name in small mono: a count, `3 unset`,
`…`. `label` names the row for a screen reader, `Sections` by default.

**Book tabs**

```tsx
import { Page, PageBody, PageHeader, TabNav } from '@bh/shell/layout';
import { Button } from '@bh/ui';

// Details is at the book's own path, so Copies and Reviews are both under it.
const TABS = [
  { to: '/books/$id', label: 'Details' },
  { to: '/books/$id/copies', label: 'Copies', badge: 3 },
  { to: '/books/$id/reviews', label: 'Reviews', badge: 12 },
];

export function BookTabs() {
  return (
    <Page
      header={
        <PageHeader
          title="Middlemarch"
          description="George Eliot, 1871"
          breadcrumb={[{ label: 'Books', path: '/books' }]}
          actions={<Button>Edit</Button>}
          tabs={<TabNav tabs={TABS} params={{ id: '42' }} label="Middlemarch's sections" />}
        />
      }
    >
      <PageBody>
        <p className="text-13/19 text-gray-11">
          Each tab is a route: /books/42, /books/42/copies, /books/42/reviews. Pick Copies, and it
          is lit alone, though its path is under Details&apos; too.
        </p>
      </PageBody>
    </Page>
  );
}
```

Wider than the screen, the row scrolls sideways rather than wrap or
widen the page, and it scrolls itself to keep the active tab in view.
`variant="pill"` draws a second row of tabs inside the body, under a
heading of its own; `underline`, the default, is the header's.

**Tabs on a phone**

```tsx
import { Page, PageBody, PageHeader, TabNav } from '@bh/shell/layout';

const TABS = [
  { to: '/rooms/$id', label: 'Overview' },
  { to: '/rooms/$id/shelves', label: 'Shelves', badge: 4 },
  { to: '/rooms/$id/books', label: 'Books', badge: 740 },
  { to: '/rooms/$id/lighting', label: 'Lighting', badge: '2 off' },
  { to: '/rooms/$id/visitors', label: 'Visitors' },
  { to: '/rooms/$id/settings', label: 'Settings' },
];

export function TabsOnAPhone() {
  return (
    <Page
      header={
        <PageHeader
          title="Front room"
          breadcrumb={[{ label: 'Rooms', path: '/rooms' }]}
          tabs={<TabNav tabs={TABS} params={{ id: 'front' }} label="Front room's sections" />}
        />
      }
    >
      <PageBody>
        <p className="text-13/19 text-gray-11">
          Six tabs are wider than a phone: the row scrolls sideways, and the page under it does not.
        </p>
      </PageBody>
    </Page>
  );
}
```

`trailing` follows the last tab, in the same row: a button that adds a
tab, as New list does below. It is not a tab, so it is never lit and not
one of the strip's items. Under `underline` the rule runs on beneath it,
and on a phone it scrolls with the tabs.

**A new list**

```tsx
import { useState } from 'react';
import { Page, PageBody, PageHeader, TabNav } from '@bh/shell/layout';
import { Button, Icon } from '@bh/ui';

// Each list is a tab and a route; New list follows them in the row, and is not one.
const LISTS = [
  { to: '/lists/to-read', label: 'To read', badge: 14 },
  { to: '/lists/reading', label: 'Reading', badge: 2 },
  { to: '/lists/read', label: 'Read', badge: 81 },
];

export function ANewList() {
  const [lists, setLists] = useState(LISTS);
  const add = () => {
    const n = lists.length + 1;
    setLists([...lists, { to: `/lists/list-${n}`, label: `List ${n}`, badge: 0 }]);
  };
  return (
    <Page
      header={
        <PageHeader
          title="Reading lists"
          tabs={
            <TabNav
              tabs={lists}
              label="Lists"
              trailing={
                <Button variant="ghost" size="sm" onClick={add}>
                  <Icon name="plus" size="sm" />
                  New list
                </Button>
              }
            />
          }
        />
      }
    >
      <PageBody>
        <p className="text-13/19 text-gray-11">
          New list sits after the last tab, on the row&apos;s rule, but it is not a tab: it is never
          lit, and pressing it adds a list rather than going to one.
        </p>
      </PageBody>
    </Page>
  );
}
```

`TabbedPage` is that page whole, as a layout route: the header and the
tab row, with the child route on screen as its body, through the router's
`Outlet`. Each tab's route draws its own body.

```tsx
import { createRootRoute, createRoute } from '@tanstack/react-router';
import { TabbedPage } from '@bh/shell/layout';

const rootRoute = createRootRoute();

const TABS = [
  { to: '/books/$id/details', label: 'Details' },
  { to: '/books/$id/copies', label: 'Copies' },
];

// The layout route: /books/$id/details and /books/$id/copies are its children.
export const bookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/books/$id',
  component: Book,
});

function Book() {
  const { id } = bookRoute.useParams();
  return <TabbedPage title="Middlemarch" tabs={TABS} params={{ id }} />;
}
```

## Rules

- **One `h1` a page.** It is `PageHeader`'s title; a `Section`'s caption
  is an `h2`.
- **No scroll of its own.** A page scrolls in the shell's `<main>`,
  header and all.
- **The body is a `PageBody` or a `CardGrid`.** `Page` is unpadded, and
  the two add the same gutters, at the full width of the page.
- **A table sits inside the body**, in its gutters, not edge to edge.
- **Actions never squeeze the title.** They drop under it on a narrow
  screen, and wrap rather than run off the band's end.
- **A tab is a route.** The active tab comes from the address, so a
  reload or a shared link opens the same one, and the longest match
  wins.
- **An empty breadcrumb draws nothing**, so a top-level page needs no
  condition.

## Reference

### Page

| Prop                  | Type        | Default | Description                                                               |
| --------------------- | ----------- | ------- | ------------------------------------------------------------------------- |
| `header`              | `ReactNode` |         | Drawn above the body: a PageHeader, as a rule.                            |
| `children` (required) | `ReactNode` |         | The body, edge to edge and unpadded: a PageBody or a CardGrid, as a rule. |

### PageHeader

| Prop               | Type                             | Default | Description                                                                                                                                                                       |
| ------------------ | -------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` (required) | `string`                         |         | The page's `h1`. At `md` it keeps to one line and truncates; at `lg` it wraps.                                                                                                    |
| `description`      | `ReactNode`                      |         | Under the title. Rich text is fine: a name in code, a link.                                                                                                                       |
| `breadcrumb`       | `readonly PageCrumb[]`           | `[]`    | The steps above this page, over the title.                                                                                                                                        |
| `backRoute`        | `NavigateOptions`                |         | Given, a Back button before the title navigates there.                                                                                                                            |
| `actions`          | `ReactNode`                      |         | Buttons at the end of the title's line; on a narrow screen they drop under it.                                                                                                    |
| `summary`          | `ReactNode`                      |         | An at-a-glance block under the title: state a page is read for, not chrome.                                                                                                       |
| `tabs`             | `ReactNode`                      |         | A tab row at the bottom of the band, sitting on its rule: a TabNav.                                                                                                               |
| `size`             | `PageHeaderSize`: `'md'`, `'lg'` | `'md'`  | `md` for a working screen, `lg` for a reading page: the title's size, and the description's.                                                                                      |
| `divider`          | `boolean`                        | `true`  | The rule along the bottom. On by default; a tab row sits on it.                                                                                                                   |
| `className`        | `string`                         |         | The band itself: its padding, its background.                                                                                                                                     |
| `contentClassName` | `string`                         |         | The block inside the band that holds everything. `mx-auto max-w-720` centres a reading page's header over a centred column, while the band and its rule still run the full width. |

```ts
type PageHeaderSize = 'md' | 'lg';
```

How much room the header takes. `md` is a working screen's: a one-line title
that truncates beside its actions. `lg` is a reading page's: a larger title
that wraps, and a description set as a lede at a readable measure.

One of `'md'`, `'lg'`.

### PageBreadcrumb

| Prop                | Type                   | Default | Description                                                     |
| ------------------- | ---------------------- | ------- | --------------------------------------------------------------- |
| `crumbs` (required) | `readonly PageCrumb[]` |         | The steps, outermost first; the page itself is not one of them. |

```ts
interface PageCrumb
```

One step above the page.

| Member             | Type     | Default | Description                                                           |
| ------------------ | -------- | ------- | --------------------------------------------------------------------- |
| `label` (required) | `string` |         | What the step says.                                                   |
| `path`             | `string` |         | Where the step links. Left out for a step that is no page of its own. |

### PageBody

| Prop                  | Type        | Default | Description                                                                                                  |
| --------------------- | ----------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `children` (required) | `ReactNode` |         | The content, top to bottom, 16 pixels apart: sections, cards, a table.                                       |
| `className`           | `string`    |         | Added to its classes, where it wins over them: `flex-1` for a body that fills the rest of the page's height. |

### Section

| Prop                  | Type        | Default | Description                                                          |
| --------------------- | ----------- | ------- | -------------------------------------------------------------------- |
| `title` (required)    | `ReactNode` |         | The caption, drawn in uppercase as an `h2`.                          |
| `count`               | `ReactNode` |         | A count, a total, a hint: rendered beside the title at caption size. |
| `action`              | `ReactNode` |         | At the right end of the caption row: a button or a link.             |
| `children` (required) | `ReactNode` |         | The content, 8px under the caption.                                  |
| `className`           | `string`    |         | Classes on the `<section>`, for its place in the body.               |

### CardGrid

| Prop                  | Type        | Default | Description              |
| --------------------- | ----------- | ------- | ------------------------ |
| `children` (required) | `ReactNode` |         | The cards, one per cell. |

### TabNav

| Prop              | Type                                     | Default       | Description                                                                                                                                    |
| ----------------- | ---------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs` (required) | `TabSpec[]`                              |               | The tabs, in order.                                                                                                                            |
| `params`          | `Record<string, string>`                 |               | Values for the tabs' `$name` placeholders, URL-encoded as they are filled in.                                                                  |
| `label`           | `string`                                 | `'Sections'`  | The row's name for a screen reader.                                                                                                            |
| `variant`         | `TabNavVariant`: `'underline'`, `'pill'` | `'underline'` | `underline` under a page header, `pill` for a row inside the body.                                                                             |
| `trailing`        | `ReactNode`                              |               | After the last tab, in the same row, but not a tab: never lit, and not one of the strip's items, e.g. a "New view" button. Nothing when unset. |

```ts
interface TabSpec
```

A tab that routes to a path, which may carry `$name` placeholders.

| Member             | Type        | Default | Description                                                                  |
| ------------------ | ----------- | ------- | ---------------------------------------------------------------------------- |
| `to` (required)    | `string`    |         | The route pattern, e.g. `/books/$id/copies`; `params` fill its placeholders. |
| `label` (required) | `string`    |         | The tab's name.                                                              |
| `badge`            | `ReactNode` |         | Beside the name, in small mono: a count, "3 unset", "…". Nothing when unset. |

```ts
type TabNavVariant = 'underline' | 'pill';
```

How the row looks: `underline` under a page header, on its rule; `pill`
for a second row of tabs inside the body, under a heading of its own.

One of `'underline'`, `'pill'`.

```ts
fillParams(pattern: string, params: Record<string, string> | undefined): string
```

A route pattern with its `$name` placeholders filled in.

Each `$name` becomes its URL-encoded value; one with no value stays as
`$name`, so a missing param shows in the address rather than vanishing.

| Parameter            | Type                                  | Default | Description                                |
| -------------------- | ------------------------------------- | ------- | ------------------------------------------ |
| `pattern` (required) | `string`                              |         | A route pattern, e.g. `/books/$id/copies`. |
| `params` (required)  | `Record<string, string> \| undefined` |         | The values, by placeholder name.           |

Returns `string`.

### TabbedPage

| Prop               | Type                     | Default | Description                                                                                        |
| ------------------ | ------------------------ | ------- | -------------------------------------------------------------------------------------------------- |
| `title` (required) | `string`                 |         | The page's `h1`, shared by every tab.                                                              |
| `description`      | `string`                 |         | Under the title, as plain text.                                                                    |
| `backRoute`        | `NavigateOptions`        |         | Given, a Back button before the title navigates there.                                             |
| `actions`          | `ReactNode`              |         | Buttons at the end of the title's line.                                                            |
| `summary`          | `ReactNode`              |         | An at-a-glance block between the title and the tab row.                                            |
| `tabs` (required)  | `TabSpec[]`              |         | The tabs, one per child route, each with a badge if it counts something. The longest match is lit. |
| `params`           | `Record<string, string>` |         | Values for the tabs' `$name` placeholders: the route's params.                                     |
