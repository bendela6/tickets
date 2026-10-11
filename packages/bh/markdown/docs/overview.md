---
title: Overview
summary: Write a page as data, check it against the blocks you register, and
  draw it with your own components.
order: 1
related: [Writing a page, Rendering a document, The block registry]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

Write a page as data, a list of prose, headings and typed blocks, check
it against the blocks you register, and draw it with your own
components.

## Import

```tsx
import { BlockErrorCard, createRegistry, DocView, markdownBlocks, parsePage } from '@bh/markdown';
```

## A first page

A registry names the blocks a page may use, and the package supplies a
set, `markdownBlocks`. `parsePage` reads a page written in YAML against it,
and `DocView` draws the result with the components you hand it. Change
the callout's `type` to `danger`: the card says why it can't draw it,
and the problem is listed under the page, on its line.

**Exporting your list**

```tsx
import {
  BlockErrorCard,
  createRegistry,
  DocView,
  markdownBlocks,
  type MarkdownElements,
  parsePage,
} from '@bh/markdown';

const registry = createRegistry(markdownBlocks);

// The look is the app's: a component per element, and the error card.
const elements: MarkdownElements = {
  h2: (p) => <h2 {...p} className="text-15 font-600 text-gray-12 mt-24 mb-8 first:mt-0" />,
  p: (p) => <p {...p} className="text-13/20 text-gray-11 mt-8 first:mt-0" />,
  ol: (p) => <ol {...p} className="text-13/20 text-gray-11 mt-8 ml-20 list-decimal" />,
  strong: (p) => <strong {...p} className="font-600 text-gray-12" />,
  errorCard: BlockErrorCard,
};

const PAGE = `title: Exporting your list
summary: Save every book on your list as one file.
body:
  - |
    Your reading list leaves as a CSV file, one book a line, which any
    spreadsheet opens.
  - h2: Export
  - |
    1. Open **Library**.
    2. Choose **Export**, or press the keys below.
    3. Pick where the file goes.
  - keyboard:
      - keys: [Ctrl+E]
        does: Exports the list.
  - h2: The file
  - code: |
      title,author,year
      Middlemarch,George Eliot,1871
      Kindred,Octavia E. Butler,1979
    lang: csv
  - callout:
      type: note
      title: Years stay as written
      content: A year is kept as the book gives it, so 1871 stays 1871.
`;

export function ExportingYourList() {
  const page = parsePage(PAGE, registry);
  return (
    <article className="w-full max-w-560">
      <DocView doc={page} registry={registry} elements={elements} />
      {page.issues.length > 0 ? (
        <ul className="text-12/18 text-red-11 mt-16 font-mono">
          {page.issues.map((issue) => {
            return (
              <li key={`${issue.line}:${issue.message}`}>
                line {issue.line}: {issue.block}: {issue.message}
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}
```

## The parts

1. **[A registry](registry.md)**: the blocks a page may use, by
   name. A block says what its body is, how to check it, how to draw it
   and how it reads as plain markdown. Each has a
   [page of its own](registry.md#the-blocks).
2. **[A page](writing-a-page.md)**: YAML, its frontmatter at the
   top, then a `body` of prose, headings and blocks. A
   [markdown document](markdown-documents.md), with blocks as
   fences and directives, parses to the same tree.
3. **[`DocView`](rendering.md)**: draws the tree. Every element is
   the host's to give, so the package has no look of its own.
4. **The copy**: `pageMarkdown` writes a page as plain markdown, for every
   reader that isn't the site: GitHub, an editor's preview, a Claude
   session in an app.
5. **[The block reference](to-prompt.md)**: `toPrompt` writes
   every block's description and examples for a model about to write a
   page.

## Who uses it

- **This site.** Every page is a `.doc.yaml` read with `parsePage`, drawn
  with `markdownBlocks` and the site's own blocks
  ([live examples](live-examples.md), props tables, references), copied by `pageMarkdown`, edited by
  [the page editor](page-editor.md) through `editPage`.
- **An app showing documents.** A help article or a stored report with
  typed blocks is drawn with `DocView` and a registry. Text the app
  didn't write, such as a note from a tool, is drawn with
  `MarkdownText`, which takes no blocks: [Prose](prose.md) is
  it, in `@bh/ui`'s look.

## Rules

- A YAML page and a markdown document parse to the same tree, so
  `DocView` draws either.
- Every problem is reported on its source line: the YAML, an item's
  shape, an attribute, a field of a block's data.
- A block that can't be drawn (no renderer, data its schema refuses, a
  throw) shows the error card in its place, and the rest of the page
  still draws.
- The engine draws plain HTML, or the host's own elements. The blocks,
  the error card and Prose are drawn with `@bh/ui`, the one bh package
  it imports besides `@bh/config`.
- A block's schema is any Standard Schema, valibot's as it is. It must
  be synchronous: an async one is reported as a problem.
