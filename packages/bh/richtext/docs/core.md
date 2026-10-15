---
title: The core
summary: The features an editor switches on, an app's own inline nodes, and
  markdown to a document and back, with no React.
order: 2
related: [Overview, RichTextEditor, Suggestions]
---

[//]: # 'written from core.doc.yaml by pnpm docs:sync; edit that file, not this one'

# The core

The features an editor switches on, an app's own inline nodes, and
markdown to a document and back, with no React.

`@bh/richtext` imports no React, so a server converts and searches the
same text the editor writes: markdown written through an API becomes a
document, and a document becomes plain text for search and excerpts.

## Import

```tsx
import { createRichText, docToMarkdown, docToText, markdownToDoc, PRESETS } from '@bh/richtext';
```

## Features

A feature is what an editor can do, switched on one by one: `marks`
(bold, italic, underline, strike, inline code, highlight, colour),
`link`, `headings`, `lists`, `taskList`, `blockquote`, `codeBlock`,
`table`, `details`, `callout`, `align`, `image`, `mentions` and
`divider`. `PRESETS.full` is all of them, for a document, and
`PRESETS.compact` a comment's: marks, links, lists, task lists, code
blocks, mentions and images. Apps store lists of these, so a name never
changes.

Each feature brings its Tiptap extensions and its toolbar controls
(`REGISTRY`); `buildExtensions` makes the extensions for a list, and
`toolbarControls` its controls, in toolbar order.

## Markdown and plain text

`markdownToDoc` reads markdown line by line: headings to H3, bulleted,
numbered and task lists, fenced code, pipe tables and paragraphs, with
the inline syntax and the inline nodes in each line. It never throws:
what it can't read stays text. `docToMarkdown` writes a document back,
and what markdown can't hold (a colour, a callout's kind) degrades.
`docToText` gives a document's plain text, one line per block, and an
inline node the words it stands for, a mention its name.

**A round trip**

```tsx
import { useState } from 'react';
import { CodeBlock } from '@bh/code';
import { docToMarkdown, docToText, markdownToDoc } from '@bh/richtext';
import { Textarea } from '@bh/ui';

export function ARoundTrip() {
  const [markdown, setMarkdown] = useState('# Packing\n\n- [x] **Tent**\n- [ ] A map, @ana');
  const doc = markdownToDoc(markdown);
  return (
    <div className="grid gap-12">
      <Textarea aria-label="Markdown" value={markdown} onChange={setMarkdown} rows={4} />
      <CodeBlock file="docToMarkdown" lang="md" value={docToMarkdown(doc)} numbers={false} />
      <CodeBlock file="docToText" value={docToText(doc)} numbers={false} />
    </div>
  );
}
```

`toDisplayDoc` turns a stored value into a document to show, whichever it
is, and `parseDoc` tells a stored document from markdown: it returns the
document, or null for markdown and for a document that no longer parses.
`isDocEmpty` says whether a document holds nothing: no text, no image
and no inline node.

## An app's own nodes

A chip naming one of the app's records (a page, an order, a recipe) is
an inline node: its Tiptap extension, the feature it comes with, how
markdown writes it, and the words it stands for. The app makes its rich
text once with its nodes, and takes the functions from there, so the
editor, the markdown round trip and search all know them. The functions
the package exports itself are the same with mentions alone.

```ts
import { Mention } from '@tiptap/extension-mention';
import { createRichText, type InlineNode } from '@bh/richtext';

const recipeRef: InlineNode = {
  name: 'recipeRef',
  feature: 'mentions',
  extensions: (suggestion) => [
    Mention.extend({ name: 'recipeRef' }).configure({ suggestion: { char: '#', ...suggestion } }),
  ],
  markdown: {
    pattern: /(?<![\w#])#([A-Z][\w-]*)/,
    parse: (match) => ({ type: 'recipeRef', attrs: { id: null, label: match[1] ?? '' } }),
    serialize: (node) => `#${String(node.attrs?.['label'] ?? '')}`,
  },
};

// Made once: the editor takes it whole, <RichTextEditor richText={richText} … />.
export const richText = createRichText({ nodes: [recipeRef] });
export const { markdownToDoc, docToMarkdown, docToText, toDisplayDoc } = richText;
```

Where a node's suggestions come from (who can be mentioned, what a `#`
looks up) stays the app's: the editor's
[suggestions](suggestions.md), or, outside it, `SuggestionHooks`
by node name, handed to `buildExtensions`. How `Prose` draws the node is
the app's too: a renderer by its name,
`<Prose nodes={{ recipeRef: RecipeChip }}>`.

## Rules

- Two inline nodes can't share a name, and a markdown pattern can't be
  global or sticky: `createRichText` throws.
- `mention` is always the first node name, and an app's own follow in
  the order given.
- Nothing here throws on bad input: markdown stays text, and a stored
  document that no longer parses reads as markdown.

## Types

```ts
createRichText(options?: RichTextOptions): RichText
```

The rich text an app writes, with its own inline nodes (a chip naming one of
its records) taken everywhere at once. An app makes it once and imports its
functions from there; an app with no nodes of its own takes the package's.

| Parameter       | Type                    | Default | Description                                  |
| --------------- | ----------------------- | ------- | -------------------------------------------- |
| `options`       | `RichTextOptions`       | `{}`    |                                              |
| `options.nodes` | `readonly InlineNode[]` | `[]`    | The app's own inline nodes, beside mentions. |

Returns `RichText`.

```ts
interface RichText
```

The editor's extensions and the converters, all knowing the same inline
nodes, so what the editor writes, markdown reads back and search finds.

| Member                       | Type                                                                                                             | Default | Description                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `nodeNames` (required)       | `readonly string[]`                                                                                              |         | The names of the inline nodes it knows, `mention` first: the keys an editor's suggestions and `SuggestionHooks` take. |
| `buildExtensions` (required) | `( features: readonly Feature[], hooks?: SuggestionHooks, options?: BuildExtensionsOptions, ) => AnyExtension[]` |         | The Tiptap extensions for these features, with the inline nodes they turn on, each given `hooks[name]`.               |
| `markdownToDoc` (required)   | `(md: string) => DocNode`                                                                                        |         | Markdown as a document, the inline nodes read where their pattern matches. It never throws.                           |
| `toDisplayDoc` (required)    | `(text: string) => DocNode`                                                                                      |         | A stored value as a document to show: the document itself, or its markdown converted.                                 |
| `parseInline` (required)     | `(source: string) => DocNode[]`                                                                                  |         | One line of markdown as inline nodes.                                                                                 |
| `docToMarkdown` (required)   | `(doc: DocNode) => string`                                                                                       |         | A document as the markdown `markdownToDoc` reads; what markdown can't hold degrades.                                  |
| `docToText` (required)       | `(doc: DocNode) => string`                                                                                       |         | A document's plain text, one line per block; an inline node gives its words.                                          |
| `isDocEmpty` (required)      | `(doc: DocNode) => boolean`                                                                                      |         | Whether the document holds no text, no image and no inline node.                                                      |

```ts
interface RichTextOptions
```

| Member  | Type                    | Default | Description                                  |
| ------- | ----------------------- | ------- | -------------------------------------------- |
| `nodes` | `readonly InlineNode[]` |         | The app's own inline nodes, beside mentions. |

```ts
interface InlineNode
```

An inline node beside the text, such as a chip naming a person or one of
the app's records. It is an atom, its attrs and no text inside. Mentions are
one; an app adds its own through `createRichText({ nodes })`, and the editor,
the markdown round trip and `docToText` all take them.

| Member                  | Type                                                                                                                                                                                           | Default | Description                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `name` (required)       | `string`                                                                                                                                                                                       |         | Its type in a document: the name its Tiptap extension gives it.                           |
| `extensions` (required) | `(suggestion?: Partial<SuggestionOptions>) => AnyExtension[]`                                                                                                                                  |         | Its Tiptap extensions. `suggestion` is the app's hook for it, `hooks[name]`.              |
| `feature`               | `Feature`: `'marks'`, `'link'`, `'headings'`, `'lists'`, `'taskList'`, `'blockquote'`, `'codeBlock'`, `'table'`, `'details'`, `'callout'`, `'align'`, `'image'`, `'mentions'`, `'divider'`     |         | The feature that puts it in the editor. Without one it is always there.                   |
| `markdown`              | `{ /** Finds it in a line of text; the match becomes the node. Not global or sticky. */ pattern: RegExp; parse: (match: RegExpMatchArray) => DocNode; serialize: (node: DocNode) => string; }` |         | How markdown writes it. Without this, markdown gets its text and reads that back as text. |
| `text`                  | `(node: DocNode) => string`                                                                                                                                                                    |         | The words it stands for in `docToText`, for search and excerpts. By default its `label`.  |

```ts
interface SuggestionHooks
```

Each inline node's suggestion config, by the node's name: `mention` for `@`,
and an app's own nodes by theirs. The lookup (who can be mentioned, what can
be referenced) is the app's; a node with no hook opens no popup.

| Member    | Type                         | Default | Description |
| --------- | ---------------------------- | ------- | ----------- |
| `mention` | `Partial<SuggestionOptions>` |         |             |

```ts
type Feature = …
```

What an editor can do, switched on one by one. Apps store lists of these
(a field's config), so a name never changes.

One of `'marks'`, `'link'`, `'headings'`, `'lists'`, `'taskList'`, `'blockquote'`, `'codeBlock'`, `'table'`, `'details'`, `'callout'`, `'align'`, `'image'`, `'mentions'`, `'divider'`.

```ts
const PRESETS: { full: Feature[]; compact: Feature[] };
```

`full` for a document, `compact` for a comment.

```ts
interface DocNode
```

A node of a document, as Tiptap's JSON writes it. The whole document is `type: 'doc'`.

| Member            | Type                      | Default | Description |
| ----------------- | ------------------------- | ------- | ----------- |
| `type` (required) | `string`                  |         |             |
| `attrs`           | `Record<string, unknown>` |         |             |
| `content`         | `DocNode[]`               |         |             |
| `marks`           | `DocMark[]`               |         |             |
| `text`            | `string`                  |         |             |

```ts
interface DocMark
```

A mark on a run of text, as Tiptap's JSON writes it: `bold`, `link` with its `href`.

| Member            | Type                      | Default | Description |
| ----------------- | ------------------------- | ------- | ----------- |
| `type` (required) | `string`                  |         |             |
| `attrs`           | `Record<string, unknown>` |         |             |

```ts
parseDoc(text: string): DocNode | null
```

The stored document, or null for markdown and for a document that no longer parses.

| Parameter         | Type     | Default | Description |
| ----------------- | -------- | ------- | ----------- |
| `text` (required) | `string` |         |             |

Returns `DocNode \| null`.

```ts
isDocEmpty(doc: DocNode): boolean
```

| Parameter        | Type      | Default | Description |
| ---------------- | --------- | ------- | ----------- |
| `doc` (required) | `DocNode` |         |             |

Returns `boolean`.

```ts
interface BuildExtensionsOptions
```

| Member        | Type                                | Default | Description                                                                                                                                                                                            |
| ------------- | ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `placeholder` | `PlaceholderOptions['placeholder']` |         | Shown while the editor is empty. A function is read on every redraw, so a placeholder that changes (once a reply's author is picked, say) needs no new extension list; an editor builds its list once. |

```ts
interface ToolbarControl
```

One control on an editor's toolbar. The groups run in this order, a
separator between each: block · marks · link · lists · blocks · insert ·
overflow. An `overflow` control is never a button on the strip; the editor
puts it in its "+" menu.

| Member             | Type                                                                                                                                                             | Default | Description |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| `id` (required)    | `string`                                                                                                                                                         |         |             |
| `group` (required) | `'block' \| 'marks' \| 'link' \| 'lists' \| 'blocks' \| 'insert' \| 'overflow'`: `'block'`, `'marks'`, `'link'`, `'lists'`, `'blocks'`, `'insert'`, `'overflow'` |         |             |

```ts
interface FeatureEntry
```

What a feature adds to an editor.

| Member                  | Type                   | Default | Description                                                                                     |
| ----------------------- | ---------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `extensions` (required) | `() => AnyExtension[]` |         | Its Tiptap extensions; none for what StarterKit already has (`buildExtensions` switches those). |
| `toolbar` (required)    | `ToolbarControl[]`     |         | Its toolbar controls.                                                                           |

```ts
type CalloutKind = 'info' | 'warning' | 'success' | 'danger';
```

A callout's tone, written on it as `data-callout`.

One of `'info'`, `'warning'`, `'success'`, `'danger'`.
