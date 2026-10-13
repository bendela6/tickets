---
title: SearchDialog
summary: 'Search what the app holds in a dialog: type, move with the arrows,
  open with Enter.'
order: 6
related: [AppShell, Sidebar parts, Dialog]
---

[//]: # 'written from search-dialog.doc.yaml by pnpm docs:sync; edit that file, not this one'

# SearchDialog

Search what the app holds in a dialog: type, move with the arrows, open
with Enter.

The dialog searches nothing itself. The app passes `search`, which turns
what the reader typed into results, and `onSelect`, which goes to the one
picked. The same dialog finds pages, records or commands, whatever the
app's `search` returns.

## Import

```tsx
import { SearchDialog, type SearchResult } from '@bh/shell';
```

## What the app passes

`search` is called with what the reader typed and returns the results,
best first. It is called with `''` as the dialog opens, so what it
returns then is what the dialog offers before anything is typed. It
answers at once, from what the app already holds, and runs only while
the dialog is open.

Each result is a `SearchResult`: an `id`, unique among one search's
results, a `label`, and optionally a `detail` line under it, a `group`
and an `icon` from `lucide-react`. A run of results in the same `group`
is listed under one heading. A result can carry fields of the app's own,
such as the path it opens: `onSelect` is called with the result as
`search` returned it, and the dialog has already closed.

**Find a book**

```tsx
import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { SearchDialog, type SearchResult } from '@bh/shell';
import { Button } from '@bh/ui';

const BOOKS: readonly SearchResult[] = [
  { id: 'middlemarch', label: 'Middlemarch', detail: 'George Eliot', group: 'Novels' },
  { id: 'persuasion', label: 'Persuasion', detail: 'Jane Austen', group: 'Novels' },
  { id: 'the-leopard', label: 'The Leopard', detail: 'Giuseppe di Lampedusa', group: 'Novels' },
  { id: 'the-prelude', label: 'The Prelude', detail: 'William Wordsworth', group: 'Poems' },
  { id: 'leaves-of-grass', label: 'Leaves of Grass', detail: 'Walt Whitman', group: 'Poems' },
  { id: 'walden', label: 'Walden', detail: 'Henry David Thoreau', group: 'Essays' },
  { id: 'essays', label: 'Essays', detail: 'Michel de Montaigne', group: 'Essays' },
].map((book) => ({ ...book, icon: BookOpen }));

// Every word must be in the title or the author's name.
function searchBooks(query: string): readonly SearchResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return BOOKS.filter((book) => {
    const text = `${book.label} ${book.detail ?? ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export function FindABook() {
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState<string>();
  return (
    <div className="flex items-center gap-12">
      <Button onClick={() => setOpen(true)}>Find a book</Button>
      <span className="text-13 text-gray-11">{opened ? `Opened ${opened}` : 'No book open'}</span>
      <SearchDialog
        open={open}
        onOpenChange={setOpen}
        search={searchBooks}
        onSelect={(book) => setOpened(book.label)}
        label="Search the shelves"
        empty="No book on the shelves matches that."
        hint="titles and authors"
      />
    </div>
  );
}
```

The words are the app's: `label` names the dialog and its field for a
screen reader, `placeholder` is the field's (the label and an ellipsis
without it), `empty` is what it says when nothing matches, and `hint`
sits at the end of the footer, saying what the search reads.

## Opened from AppShell

The dialog binds no key of its own. `AppShell` already has one way in:
given `onSearch`, its sidebar field becomes the button to the app's
search, the phone's top bar gets a search button, and Ctrl K (⌘K on
Apple platforms) calls it from anywhere. The app holds whether the
dialog is open and opens it from there, as in
[AppShell's search](app-shell.md#search). In an app, `onSelect`
goes to the result's page with the router:

```tsx
import { useState } from 'react';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { BookOpen, Library } from 'lucide-react';
import { AppShell, SearchDialog, type NavSection, type SearchResult } from '@bh/shell';
import { TooltipProvider } from '@bh/ui';

const NAV: readonly NavSection[] = [
  { id: 'shop', label: 'Shop', items: [{ label: 'Books', path: '/books', icon: BookOpen }] },
];

const BRAND = { mark: <Library size={18} strokeWidth={1.75} />, name: 'bookshop' };

// A book the search finds, with the page it opens.
interface BookResult extends SearchResult {
  path: string;
}

const BOOKS: readonly BookResult[] = [
  { id: 'middlemarch', label: 'Middlemarch', detail: 'George Eliot', path: '/books/1' },
  { id: 'persuasion', label: 'Persuasion', detail: 'Jane Austen', path: '/books/2' },
];

function searchBooks(query: string): readonly BookResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return BOOKS.filter((book) => words.every((word) => book.label.toLowerCase().includes(word)));
}

export function Root() {
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  return (
    <TooltipProvider>
      <AppShell
        sections={NAV}
        brand={BRAND}
        storagePrefix="bookshop-nav"
        onSearch={() => setSearching(true)}
      >
        <Outlet />
      </AppShell>
      <SearchDialog
        open={searching}
        onOpenChange={setSearching}
        search={searchBooks}
        onSelect={(book) => {
          void navigate({ to: book.path });
        }}
        label="Search the shop"
      />
    </TooltipProvider>
  );
}
```

## Keyboard and accessibility

| Key              | Does                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| `Ctrl+K` or `⌘K` | Opens the dialog from anywhere, through AppShell's onSearch.            |
| `↓` or `↑`       | Lights the next or the previous result, and scrolls it into view.       |
| `Enter`          | Opens the lit result. The dialog closes and onSelect is called with it. |
| `Esc`            | Closes the dialog, opening nothing.                                     |

The dialog is named by `label`, and so is its field, which has the focus
as it opens. The first result is lit, and typing lights the first again.
The lit row is marked `aria-current`, and the mouse lights the row under
it. Each row is a button, so Tab reaches them from the field.

## Rules

- **It searches nothing itself.** The results are what `search`
  returns, drawn in its order: the dialog never filters or sorts them.
- **`search` answers at once.** It returns the results, not a promise,
  so it searches what the app already holds.
- **Each `id` is unique** among one search's results: it is the row's
  key.
- **No app words.** `label`, `placeholder`, `empty` and `hint` are the
  app's; without them the dialog says Search.
- **It starts afresh.** The query and the lit row are forgotten when it
  closes.
- **The shortcut is the frame's.** The dialog binds no key to open
  itself; `AppShell` binds Ctrl K / ⌘K to `onSearch`, so the shortcut
  has one owner.

## Reference

`T` is the app's result: a `SearchResult` with any fields of its own,
which `search` returns and `onSelect` is handed back. `LucideIcon` is
the type of an icon component from `lucide-react`, such as `BookOpen`.

| Prop                      | Type                              | Default                   | Description                                                                                                                                                                                                 |
| ------------------------- | --------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open` (required)         | `boolean`                         |                           | Whether the dialog is open.                                                                                                                                                                                 |
| `onOpenChange` (required) | `(open: boolean) => void`         |                           | Called with `false` when it closes: by Esc, a click on the dim, or a pick.                                                                                                                                  |
| `search` (required)       | `(query: string) => readonly T[]` |                           | The results for what the reader typed, best first. Called while the dialog is open, with `''` as it opens, for what to offer before anything is typed. It answers at once, from what the app already holds. |
| `onSelect` (required)     | `(result: T) => void`             |                           | Called with the result picked, by Enter or a click, as the dialog closes.                                                                                                                                   |
| `label`                   | `string`                          | `'Search'`                | The dialog's name, for a screen reader, and the field's.                                                                                                                                                    |
| `placeholder`             | `string`                          |                           | The field's placeholder. Without it, the label and an ellipsis: `Search…`.                                                                                                                                  |
| `empty`                   | `ReactNode`                       | `'Nothing matches that.'` | What the dialog says when nothing matches.                                                                                                                                                                  |
| `hint`                    | `ReactNode`                       |                           | A note at the end of the footer, such as what the search reads.                                                                                                                                             |

```ts
interface SearchResult
```

What the dialog shows of a result. The app's own fields ride along to `onSelect`.

| Member             | Type         | Default | Description                                                                                            |
| ------------------ | ------------ | ------- | ------------------------------------------------------------------------------------------------------ |
| `id` (required)    | `string`     |         | Unique among one search's results: the row's key.                                                      |
| `label` (required) | `string`     |         | The first line: what the result is called.                                                             |
| `detail`           | `string`     |         | A quieter second line, such as the heading it found or the text around a match.                        |
| `group`            | `string`     |         | The heading over a run of results. A result in the same group as the one above it shares that heading. |
| `icon`             | `LucideIcon` |         | A lucide icon before the label.                                                                        |
