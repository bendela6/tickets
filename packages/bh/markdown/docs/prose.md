---
title: Prose
summary: Draws markdown, or a document the rich text editor stores, as prose in
  the editor's look.
order: 5
related: [RichTextEditor, The core, JsonViewer, Textarea]
---

[//]: # 'written from prose.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Prose

Draws markdown, or a document the rich text editor stores, as prose in
the editor's look, so a text reads as it edits.

It reads markdown, CommonMark and GitHub's additions (tables,
strikethrough, footnotes), with `MarkdownText`. A document, the JSON
`@bh/richtext` stores or the document itself, it walks node by node,
drawing each as the editor does, so showing one never loads the editor.
Both wear the editor's look, `.rt`. Empty or missing text renders
nothing.

## Import

```tsx
import { Prose } from '@bh/markdown';
```

## Examples

Headings, lists, code, tables and links, in the editor's type and
colours. A fence is a plain code block.

**Notes**

```tsx
import { Prose } from '@bh/markdown';

const NOTES = `## Packing list

Bring **two** bags, and see [the weather](https://example.com/weather) first.

- Apples
- Pears
- A \`map.pdf\` on the phone

| City   | Days |
| ------ | ---- |
| Lisbon | 3    |
| Porto  | 2    |

\`\`\`sh
cp map.pdf ~/trip/
\`\`\``;

export function Notes() {
  return <Prose>{NOTES}</Prose>;
}
```

A stored document, as the editor writes it: its JSON, or the document
itself. bh's own nodes are drawn as the editor draws them: a mention's
chip, a task's checkbox (shown, not ticked here), a callout by its kind,
an image.

**A stored document**

```tsx
import { Prose } from '@bh/markdown';

// What the rich text editor stores: its document, as JSON.
const STORED = JSON.stringify({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Before you go' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Ask ' },
        { type: 'mention', attrs: { id: 2, label: 'Rui Lima' } },
        { type: 'text', text: ' for the keys, and ' },
        { type: 'text', text: 'water the ferns', marks: [{ type: 'bold' }] },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Close the windows' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Empty the fridge' }] }],
        },
      ],
    },
    {
      type: 'callout',
      attrs: { kind: 'warning' },
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'The back door sticks: lift it.' }] },
      ],
    },
  ],
});

export function AStoredDocument() {
  return <Prose>{STORED}</Prose>;
}
```

The same text, edited and read: the editor and Prose draw a document as
the same markup under `.rt`, so nothing moves between the two. Edit the
left; the right follows.

**Reads as it edits**

```tsx
import { useState } from 'react';
import { Prose } from '@bh/markdown';
import { RichTextEditor } from '@bh/richtext/editor';

const START = `## Opening hours

Open **every day** but Monday, from 9 to 18.

1. Ring the bell
2. Wait by the gate

Closed on public holidays.`;

export function ReadsAsItEdits() {
  const [text, setText] = useState(START);
  return (
    <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
      <RichTextEditor label="Opening hours" features="full" value={text} onChange={setText} />
      <Prose className="py-10">{text}</Prose>
    </div>
  );
}
```

## An app's own nodes

An app that adds inline nodes to its editor (a chip naming one of its
records, through `createRichText({ nodes })`) hands Prose a renderer for
each, by the node's type, in `nodes`. A renderer gets the node and its
content, drawn, and draws it as the app likes, a link to the record
here. One by the name of bh's own (`callout`, `mention`, `image`)
draws that node the app's way. A node with no renderer keeps its words,
its `label`, so nothing is lost.

**Chips of your own**

```tsx
import type { ProseNodeProps } from '@bh/markdown';
import { Prose } from '@bh/markdown';
import { Pill } from '@bh/ui';

// An app's own node, as it adds it to its editor: a chip naming one of its
// records. Prose draws it with the app's renderer, by the node's type.
function RecipeChip({ node }: ProseNodeProps) {
  const label = String(node.attrs?.['label'] ?? '');
  return (
    <a href={`#recipe-${label.toLowerCase()}`}>
      <Pill label={label} />
    </a>
  );
}

// Made once, outside the component, so Prose keeps its renderers.
const NODES = { recipeRef: RecipeChip };

const STORED = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Serve it with ' },
        { type: 'recipeRef', attrs: { id: 31, label: 'Salsa' } },
        { type: 'text', text: ' and ' },
        { type: 'recipeRef', attrs: { id: 7, label: 'Flatbread' } },
        { type: 'text', text: '.' },
      ],
    },
  ],
};

export function ChipsOfYourOwn() {
  return (
    <div className="flex flex-col gap-12">
      <Prose nodes={NODES}>{STORED}</Prose>
      {/* With no renderer for it, a node keeps its words. */}
      <Prose>{STORED}</Prose>
    </div>
  );
}
```

Keep `nodes` stable, made once outside the component, as the app's rich
text is.

## Never running what it is handed

Raw HTML draws nothing, a `:::` block is text, and a link whose scheme is
not `http:`, `https:` or `mailto:` is plain text. A document's links
keep to the same schemes, its images to the web's, the app's own and
an image's data, and its colours to a colour's syntax, so a stored
document can't run a script or style the page.

**Untrusted text**

```tsx
import { Prose } from '@bh/markdown';

const TEXT = `:::note
Stays text.
:::

A <b>bold</b> word, a [script link](javascript:void(0)) and a [mail link](mailto:name@example.com).`;

export function UntrustedText() {
  return <Prose>{TEXT}</Prose>;
}
```

## Keyboard and accessibility

Headings keep their level but take no `id`, since a screen can hold many
notes with the same heading. An image keeps its alt text, empty when it
has none. A task's checkbox is off, and named by its task.

## Props

| Prop                  | Type                        | Default | Description                                                                                                                                                                                              |
| --------------------- | --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `children` (required) | `string \| DocNode \| null` |         | The text: markdown, or an editor's document, as its JSON (the text `@bh/richtext` stores, starting `{"type":"doc"`) or as the document itself. Empty, blank or missing, nothing renders.                 |
| `nodes`               | `ProseNodes`                |         | How a document's nodes are drawn, by the node's `type`: the app's own (a chip naming one of its records), or its own way of drawing one of bh's (`callout`, `mention`, `image`). Keep the object stable. |
| `className`           | `string`                    |         | Added to the wrapper's classes.                                                                                                                                                                          |

## Types

```ts
type ProseNodes = Readonly<Record<string, ComponentType<ProseNodeProps>>>;
```

The renderers for a document's nodes, by the node's `type`: an app's own
(`ticketRef`), or one of bh's it draws its own way. Keep the object stable.

```ts
interface ProseNodeProps
```

What a node's renderer is handed.

| Member            | Type        | Default | Description                                                                 |
| ----------------- | ----------- | ------- | --------------------------------------------------------------------------- |
| `node` (required) | `DocNode`   |         | The node, as the document holds it: its `type`, its `attrs`, its `content`. |
| `children`        | `ReactNode` |         | Its content, drawn; none for a node that holds none, such as a chip.        |

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
