---
title: The page editor
summary: Edit a page on the site while pnpm docs:dev runs, and save it to its
  file with its comments and layout kept.
order: 8
related: [Writing a page, Live examples, toPrompt]
---

[//]: # 'written from page-editor.doc.yaml by pnpm docs:sync; edit that file, not this one'

# The page editor

Edit a page on the site while `pnpm docs:dev` runs, and save it to its
file with its comments and layout kept.

## Editing a page

Edit page, among the page's actions, opens the page for editing. It is
there only in `pnpm docs:dev`, which can write files, and not on a
block's generated page, which has no file. A bar sticks over the page
while it is open: the file's name, how many edits are unsaved, how many
problems the page has, and Block reference, Undo, Discard, Save and
Done.

Each item is drawn on its own. Hovered or focused, it shows a toolbar:
Edit, Move up, Move down, Add below and Delete. Above the first item,
Edit details opens the frontmatter as a form: title, summary, order and
related pages.

- **Prose** opens as its markdown, in a text area.
- **A heading** opens as its level, `h2` or `h3`, and its text.
- **A block** opens as a form, where its renderer gives it one: its main
  attribute, or its data's fields from its schema, or its body (code in
  the code editor, markdown in a text area), then each attribute. An
  attribute with `values` is a select, a number a number field, a yes/no
  is Default, Yes or No, and the rest are text. Edit as YAML switches to
  the item's YAML, and back. A block no form can hold, such as one whose
  markdown body is a list, opens as YAML.
- **Add below** offers prose, a heading, every registered block by its
  group, and any block as YAML. A new block starts as its first example.

| Key                         | Does                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `Esc`                       | Closes the open editor and keeps the item as it was.                 |
| `Ctrl+Enter` or `Cmd+Enter` | Applies the open editor's change, as Done does, from anywhere in it. |

## Drafts

The edits are a draft: the page as it was opened, and each edit since.
The page draws the draft and reads it again as it changes, so a problem
shows on its item at once, and Save waits until there is none. Undo takes
back the last edit; two changes in a row to one item are one edit.

A draft is kept in the browser, by the page's file, until it is saved
or discarded, so a reload comes back to it. If the file changes on disk
under unsaved edits, the bar says so and Save is refused: Discard, then
edit again.

## Saving

Save posts the page's file, the text the draft began from, and the edits
to the dev server. The server applies them with the site's own code and
reads the result as the site does, then writes the page and its markdown
copy, both through Prettier. It refuses:

- a file that isn't a `.doc.yaml` in the repo;
- a page changed on disk since the draft began;
- a page that wouldn't read cleanly, listing its problems on the bar.

Only the site may save: a JSON post from its own origin. A built site
has no server, so it never shows Edit page.

While the page is open for editing, an example naming a file that isn't
there shows Create, which writes the file with a component named from
it. An edit in an example's live panel is never written back
(see [Live examples](live-examples.md#edits)).

## The writer

`editPage(source, edits)` applies edits to a page's YAML through the
`yaml` package's document API, so what an edit doesn't touch stays as
written: comments, quoting, the order of keys. An edit names an item by
its place in `body`, from 0, and gives it as a page writes it: a string
for prose, `{ h2: 'Props' }` for a heading, `{ callout: {…} }` for a
block. `pageItem(node, renderer)` writes a parsed block back as such an
item.

- **`set`** merges the new item into the one it replaces, so an
  unchanged field keeps its comment. An item that names another block
  is replaced whole.
- **`insert`** puts a new item before the one at `index`; the length
  appends it.
- **`remove`** takes an item out, with the comment above it.
- **`move`** takes the item at `from` to `to`, with its comment.
- **`meta`** sets a frontmatter field, a new one above `body`, or
  removes it when the value is `undefined`.

Here four edits are made to a short page. The comment above Novels and
the `|` under each prose item stay as they were. Change an edit, or
add one, and switch between the two.

**Four edits**

```tsx
import { useState } from 'react';
import { CodeBlock, editPage, type PageEdit } from '@bh/markdown';
import { SegmentedControl } from '@bh/ui';

const PAGE = `title: Reading list
summary: The books on the shelf by the window.
body:
  - |
    Five books, in the order they were bought.
  # Novels first, then the rest.
  - h2: Novels
  - |
    Middlemarch, Kindred and Possession.
  - callout:
      type: note
      title: On loan
      content: Kindred is with Nino until May.
  - h2: Poetry
  - |
    Two collections by Szymborska.
`;

// Each edit names an item by its place in body, from 0.
const EDITS: PageEdit[] = [
  {
    op: 'set',
    index: 3,
    item: { callout: { type: 'tip', title: 'On loan', content: 'Kindred is back on the shelf.' } },
  },
  { op: 'insert', index: 6, item: 'Read aloud on Sundays.' },
  { op: 'move', from: 3, to: 2 },
  { op: 'meta', key: 'related', value: ['Wish list'] },
];

const VIEWS = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
];

export function FourEdits() {
  const [view, setView] = useState('after');
  const yaml = view === 'before' ? PAGE : editPage(PAGE, EDITS);
  return (
    <div className="flex w-full max-w-560 flex-col gap-12">
      <SegmentedControl label="Page" options={VIEWS} value={view} onChange={setView} />
      <CodeBlock lang="yaml" value={yaml} />
    </div>
  );
}
```

## Rules

- A page saved with no edits comes back byte for byte: `docs:check`
  saves every page so, and its copy too.
- Every block on every page comes back unchanged through its form,
  which `docs:check` checks.
- Prose is always written with `|`, and any new text over more than one
  line is too.
- `editPage` throws on a page that doesn't parse, and on an edit naming
  an item the page doesn't have.
- `pageItem` writes attributes typed as the renderer declares them, and
  throws for a markdown body written as a list, which only YAML holds.
- A save is refused, never merged, when the file changed on disk.

## Reference

```ts
editPage(source: string, edits: readonly PageEdit[]): string
```

The page with `edits` applied in order, as YAML. Throws on a page that
doesn't parse, or an edit naming an item it doesn't have.

| Parameter           | Type                  | Default | Description |
| ------------------- | --------------------- | ------- | ----------- |
| `source` (required) | `string`              |         |             |
| `edits` (required)  | `readonly PageEdit[]` |         |             |

Returns `string`.

```ts
type PageEdit = …
```

One change to a page. An item is named by its place in `body`, and given
as a page writes it: a string for prose, `{ h2: 'Props' }` for a heading,
`{ callout: {…} }` or `{ example: 'examples/a.tsx', mode: 'split' }` for a
block (see `pageItem`).

```ts
pageItem(node: BlockNode, renderer: AnyRenderer): Record<string, unknown>
```

A parsed block as a page writes it: its name holding its body (or its
main attribute), then its other attributes, typed as the renderer
declares them. What `editPage` takes as an item.

| Parameter             | Type          | Default | Description |
| --------------------- | ------------- | ------- | ----------- |
| `node` (required)     | `BlockNode`   |         |             |
| `renderer` (required) | `AnyRenderer` |         |             |

Returns `Record<string, unknown>`.
