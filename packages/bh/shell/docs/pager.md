---
title: Pager
summary: Link a page to the pages either side of it in reading order, at its foot.
order: 8
related: [Pages, OnThisPage]
---

[//]: # 'written from pager.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Pager

Link a page to the pages either side of it in reading order, at its
foot.

The order is the app's: a guide's chapters, the pages of a sidebar
from top to bottom. The app works out the page before this one and the
page after it, and hands the two in; the pager draws a link to each,
under a rule, the previous on the left and the next on the right.

## Import

```tsx
import { Pager, type PagerPage } from '@bh/shell/layout';
```

## The two pages

`previous` and `next` are each a `PagerPage`: the `label` the link
says, under the way it lies, and the `path` it goes to, through the
router. Leave `previous` out on the first page and `next` on the last:
the next page keeps to the right with or without one before it. With
neither, the pager draws nothing.

Below, the guide keeps the chapter on screen in state, and
`onNavigate`, called with the page the reader followed, says which.
Follow **Next** to the end and back.

**A guide in chapters**

```tsx
import { useState } from 'react';
import { Page, PageBody, PageHeader, Pager, type PagerPage } from '@bh/shell/layout';

interface Chapter extends PagerPage {
  text: string;
}

// The guide's chapters in reading order: the app's own.
const CHAPTERS: readonly Chapter[] = [
  {
    label: 'Choosing a book',
    path: '/mending/choosing',
    text: 'Start on a book nobody will miss: a paperback from a box at the market.',
  },
  {
    label: 'Loose pages',
    path: '/mending/loose-pages',
    text: 'Tip a loose page back in with a thin line of paste along its inner edge.',
  },
  {
    label: 'A torn page',
    path: '/mending/a-torn-page',
    text: 'Bridge a tear with a strip of tissue and wheat starch, its edges eased together.',
  },
  {
    label: 'A broken spine',
    path: '/mending/a-broken-spine',
    text: 'Reback a spine split down a joint, or recase a book whose boards have come away.',
  },
];

export function AGuideInChapters() {
  // In an app the chapter on screen is the route's. Here it is kept in state,
  // and onNavigate says which the reader went to.
  const [at, setAt] = useState(0);
  const chapter = CHAPTERS[at];
  if (!chapter) {
    return null;
  }

  return (
    <Page header={<PageHeader title={chapter.label} breadcrumb={[{ label: 'Mending' }]} />}>
      <PageBody>
        <p className="text-15/24 text-gray-12">{chapter.text}</p>
        <Pager
          previous={CHAPTERS[at - 1]}
          next={CHAPTERS[at + 1]}
          onNavigate={(page) => setAt(CHAPTERS.findIndex((each) => each.path === page.path))}
          className="mt-24"
        />
      </PageBody>
    </Page>
  );
}
```

`label` names the pair for a screen reader, `Previous and next` unless
given, and `className` places it at the foot of the page: the docs
site sets it 64 pixels under the page's last section.

## In an app

The page on screen is the route's, so the app finds it in its order by
the path, and passes the pages either side. `onNavigate` is left out:
the route changing is all there is to it.

```tsx
import { useRouterState } from '@tanstack/react-router';
import { Pager, type PagerPage } from '@bh/shell/layout';

// The guide's chapters in reading order: the app's own.
const CHAPTERS: readonly PagerPage[] = [
  { label: 'Choosing a book', path: '/mending/choosing' },
  { label: 'Loose pages', path: '/mending/loose-pages' },
  { label: 'A torn page', path: '/mending/a-torn-page' },
];

export function ChapterPager() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const at = CHAPTERS.findIndex((chapter) => chapter.path === pathname);
  if (at === -1) {
    return null;
  }
  return <Pager previous={CHAPTERS[at - 1]} next={CHAPTERS[at + 1]} className="mt-64" />;
}
```

## Keyboard and accessibility

| Key     | Does                                                |
| ------- | --------------------------------------------------- |
| `Tab`   | Moves to the previous page's link, then the next's. |
| `Enter` | Goes to the focused link's page.                    |

The pair is a navigation landmark, named by `label`. Each link is named
by the way it lies and the page's name, `Next, Loose pages`, since
stacked the two would be read as one word, and carries `rel="prev"` or
`rel="next"`.

## Rules

- **The order is the app's.** The pager knows only the two pages it is
  handed.
- **A link is a route.** It goes to its `path` through the router, as
  a breadcrumb's step does.
- **The previous on the left, the next on the right**, whichever of
  them there is.
- **Neither draws nothing**, so a page that stands alone needs no
  condition.

## Reference

| Prop         | Type                        | Default               | Description                                                                         |
| ------------ | --------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `previous`   | `PagerPage`                 |                       | The page before this one. Left out on the first page.                               |
| `next`       | `PagerPage`                 |                       | The page after this one. Left out on the last page.                                 |
| `onNavigate` | `(page: PagerPage) => void` |                       | Called with the page as the reader follows its link, which goes there all the same. |
| `label`      | `string`                    | `'Previous and next'` | The links' name, as a group, for a screen reader.                                   |
| `className`  | `string`                    |                       | Classes on the `<nav>`, for its place at the page's foot.                           |

```ts
interface PagerPage
```

A page the pager links to.

| Member             | Type     | Default | Description                      |
| ------------------ | -------- | ------- | -------------------------------- |
| `label` (required) | `string` |         | Its name, under the way it lies. |
| `path` (required)  | `string` |         | Where it links.                  |
