---
title: Rendering a document
summary: Draw a parsed page or a markdown document with your own component for
  each element, for code, and for a block that fails.
order: 4
related: [The block registry, Markdown documents, Prose]
---

[//]: # 'written from rendering.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Rendering a document

Draw a parsed page or a markdown document with your own component for
each element, for code, and for a block that fails.

## Drawing a page

`DocView` takes a parsed page as `doc`, and the registry it was read
with. It draws the page's nodes in order: markdown with the elements you
give it, each block through its renderer. A YAML page is read with
`parsePage` first, as in the [Overview](overview.md#a-first-page).

`MarkdownDoc` takes a markdown document as `source` instead, and parses
it itself, again only when the source or the registry changes. Both
take `ctx`, which every block is handed as it is: the site passes the
page's own file there, so an example finds its file beside the page.

## Your elements

`elements` maps an HTML tag to the component that draws it, taking that
element's props: `p`, `h2`, `a`, `ul`, `table`, `td` and the rest. A tag
left out is drawn as the plain element, so with no elements a page is
unstyled HTML. Two more keys take what a tag can't:

- **`codeBlock`** draws a fence that is no block, given its `lang`, the
  rest of its opening line as `meta`, and its `value`. `code` is inline
  code only.
- **`errorCard`** draws a block that couldn't be drawn, given a `title`
  and its `reasons`.

There is one for each: `@bh/code`'s `CodeBlock`, and this package's
`BlockErrorCard`. Keep the map in a constant: every block reads it from
the page's context, which changes with it.

```tsx
import { CodeBlock } from '@bh/code';
import { BlockErrorCard, type MarkdownElements } from '@bh/markdown';

export const ELEMENTS: MarkdownElements = {
  h2: ({ id, children }) => (
    <h2 id={id} className="text-18/26 font-600 text-gray-12 mt-32 first:mt-0">
      {children}
    </h2>
  ),
  p: ({ children }) => <p className="text-15/24 text-gray-11 mt-12 first:mt-0">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} className="text-indigo-11 underline underline-offset-2">
      {children}
    </a>
  ),
  codeBlock: ({ lang, value }) => <CodeBlock lang={lang} value={value} />,
  errorCard: BlockErrorCard,
};
```

A heading is handed its `id` like any other prop: its text slugged, the
same id the parse lists it under. A screen that draws many documents
leaves it off, as `Prose` does, so two with the same heading don't share
one.

## When a block fails

A block that can't be drawn shows the error card in its place, and the
rest of the page still draws. The card says which of three things went
wrong:

- **No renderer** is named for it: `No renderer named "aside"`.
- **Its data fails its schema**: `Block "callout" failed validation`,
  with each problem's field and message. The schema runs once per parse,
  not on every draw.
- **It throws** as it draws: `Block "price" failed to render`, with the
  error's message. A new parse gives it another try, so a fixed source
  draws it again.

Here the app registers a `price` block of its own, beside `markdownBlocks`.
Give the second callout a `title`, or the second price a number, and
its card gives way to the block.

**Three ways to fail**

```tsx
import {
  BlockErrorCard,
  markdownBlocks,
  MarkdownDoc,
  type MarkdownElements,
  type Renderer,
} from '@bh/markdown';

const EUROS = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

// A block of the app's own, which throws on a price it can't read.
const priceBlock: Renderer<string> = {
  name: 'price',
  body: 'text',
  description: 'A price in euros: the amount as a number, drawn with its currency.',
  examples: [':::price\n12.50\n:::'],
  component: ({ data }) => {
    const amount = Number(data.trim());
    if (data.trim() === '' || Number.isNaN(amount)) {
      throw new Error(`"${data.trim()}" is not an amount`);
    }
    return <p className="text-15 font-600 text-gray-12 mt-8">{EUROS.format(amount)}</p>;
  },
};

const registry = markdownBlocks.register({ price: priceBlock });

const elements: MarkdownElements = {
  h2: (p) => <h2 {...p} className="text-15 font-600 text-gray-12" />,
  p: (p) => <p {...p} className="text-13/20 text-gray-11 mt-8" />,
  errorCard: BlockErrorCard,
};

const DOC = `## Order 1042

It ships in two parts, each with its own price.

:::callout
type: tip
title: Tracking
content: Each part has its own tracking link.
:::

:::price
12.50
:::

:::price
twelve
:::

:::callout
type: tip
content: This one has no title.
:::

:::aside
No block is named aside.
:::
`;

export function ThreeWaysToFail() {
  return (
    <article className="w-full max-w-560">
      <MarkdownDoc source={DOC} registry={registry} elements={elements} />
    </article>
  );
}
```

## Text the app didn't write

`MarkdownText` draws plain markdown, GitHub's tables, strikethrough and
footnotes included, with your elements: no frontmatter, no blocks, no
marks. A fence is a code block, a `:::` line or a `:mark[…]` is text,
and raw HTML draws nothing. It is for what the app didn't write, such as
a note a tool left, where a fence must never reach a renderer.

[Prose](prose.md) is `MarkdownText` in the rich text editor's look. It also draws a link whose scheme isn't `http`,
`https` or `mailto` as text, and gives headings no id.

## Rules

- A tag left out of `elements` is the plain element: the package has no
  look of its own.
- A block that fails draws the card in its place, and its siblings still
  draw. An inline mark that throws shows the card too; one with no
  renderer stays as written.
- A data block's schema runs once per parse. An async schema isn't run
  as the page draws, so its block draws unchecked.
- Raw HTML draws nothing. A reference link with no definition stays as
  written, brackets and all, so the slip shows.
- A link definition anywhere in the page, a block's markdown included,
  serves a reference anywhere in it.

## Reference

| Prop                  | Type               | Default       | Description                                                                     |
| --------------------- | ------------------ | ------------- | ------------------------------------------------------------------------------- |
| `doc` (required)      | `Doc`              |               | The parsed page: from `parsePage`, `parseDocument`, or one of its items.        |
| `registry` (required) | `Registry`         |               | The blocks it is drawn with; the one it was parsed with.                        |
| `ctx`                 | `RenderContext`    | `NO_CONTEXT`  | Whatever the host hands every block: the current route, a theme, a data source. |
| `elements`            | `MarkdownElements` | `NO_ELEMENTS` | The host's components for markdown's elements; keep the object stable.          |

| Prop                  | Type               | Default | Description                                                                      |
| --------------------- | ------------------ | ------- | -------------------------------------------------------------------------------- |
| `registry` (required) | `Registry`         |         | The blocks it is drawn with; the one it was parsed with.                         |
| `ctx`                 | `RenderContext`    |         | Whatever the host hands every block: the current route, a theme, a data source.  |
| `elements`            | `MarkdownElements` |         | The host's components for markdown's elements; keep the object stable.           |
| `source` (required)   | `string`           |         | A markdown document: frontmatter, markdown, and blocks as fences and directives. |

| Prop                | Type               | Default | Description                                                                 |
| ------------------- | ------------------ | ------- | --------------------------------------------------------------------------- |
| `source` (required) | `string`           |         | Plain markdown, GFM included: every fence, `:::` and mark in it stays text. |
| `elements`          | `MarkdownElements` |         | The host's components for markdown's elements; keep the object stable.      |

```ts
interface MarkdownElements extends TagElements
```

What the host draws markdown with. Anything left out is the plain HTML
element, so the package draws nothing of its own look; an `h2` is handed
its heading's `id` like any other prop. `code` is inline code only: a code
block goes to `codeBlock`, which gets the language and the text.

| Member      | Type                            | Default | Description                                                                               |
| ----------- | ------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `codeBlock` | `ComponentType<CodeBlockProps>` |         | Draws a fence that is no block: plain `<pre><code>` when left out.                        |
| `errorCard` | `ComponentType<ErrorCardProps>` |         | Draws a block that could not be drawn, and why: a plain `role="alert"` box when left out. |

```ts
type TagElements = { [Tag in MarkdownTag]?: ComponentType<ComponentPropsWithoutRef<Tag>> };
```

A component in place of an HTML element, taking that element's props.

```ts
interface CodeBlockProps
```

A fenced code block that is not a registered block.

| Member             | Type     | Default | Description                                               |
| ------------------ | -------- | ------- | --------------------------------------------------------- |
| `lang`             | `string` |         | The fence's first word: ```ts gives `ts`.                 |
| `meta`             | `string` |         | The rest of the fence's opening line, after the language. |
| `value` (required) | `string` |         | The code, as written.                                     |

```ts
interface ErrorCardProps
```

What a reader sees where a block should have been.

| Member               | Type                | Default | Description                                                        |
| -------------------- | ------------------- | ------- | ------------------------------------------------------------------ |
| `title` (required)   | `string`            |         | What did not render: `Block "callout" failed validation`.          |
| `reasons` (required) | `readonly string[]` |         | Why, one reason each, in the validator's or the error's own words. |

```ts
type RenderContext = Record<string, unknown>;
```

Whatever the host hands every block as it draws a page: the page's file, a
route, a theme. The package reads nothing in it.

```ts
interface Doc
```

A parsed page: what `DocView` draws.

| Member                   | Type                      | Default | Description                                                                                  |
| ------------------------ | ------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `frontmatter` (required) | `Record<string, unknown>` |         | What the page says about itself: a document's `---` block, or a YAML page's keys but `body`. |
| `nodes` (required)       | `Node[]`                  |         | The page's own nodes, in order: markdown, and the blocks between it.                         |
| `headings` (required)    | `Heading[]`               |         | The headings in the page's own nodes, not those inside its blocks.                           |
| `blocks` (required)      | `BlockNode[]`             |         | Every block, nested ones too, each parent before the blocks inside it.                       |

```ts
interface Heading
```

A heading of the page's own, for an on-this-page list or a search index.

| Member             | Type     | Default | Description                                               |
| ------------------ | -------- | ------- | --------------------------------------------------------- |
| `depth` (required) | `number` |         | 2 for `##` or `- h2:`, and so on.                         |
| `text` (required)  | `string` |         | Its text, marks flattened away.                           |
| `id` (required)    | `string` |         | Its text slugged: the id the drawn heading takes.         |
| `line` (required)  | `number` |         | The line it is on, from 1.                                |
| `firstParagraph`   | `string` |         | The text of the paragraph right after it, if one follows. |
