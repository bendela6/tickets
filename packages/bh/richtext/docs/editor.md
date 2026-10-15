---
title: RichTextEditor
summary: Writes rich text on a field's floor, holding a document and reporting
  each edit as its JSON.
order: 3
related: [The toolbar, The composer, Prose, Textarea]
---

[//]: # 'written from editor.doc.yaml by pnpm docs:sync; edit that file, not this one'

# RichTextEditor

Writes rich text on a field's floor, holding a document and reporting
each edit as its JSON.

It is Tiptap's editor as a bh control, as `Textarea` is one: `value` and
`onChange` speak text, `tone` colours it, `disabled` fades it, and
`readOnly` prints it. Its features say what it can do, and its
[toolbar](toolbar.md) shows them while it can be edited.

## Import

```tsx
import { RichTextEditor } from '@bh/richtext/editor';
```

## Examples

A document, with every feature (`features="full"`, the default). Its
`value` may be markdown, which it reads as a document; each edit comes
back through `onChange` as the document's JSON.

**A document**

```tsx
import { useState } from 'react';
import { RichTextEditor } from '@bh/richtext/editor';

const PLAN = `## Weekend in Porto

Pack **light**, and check [the forecast](https://example.com/weather) first.

- Book the train
- Find a café near the river

The tiles are blue and white, almost everywhere.`;

export function ADocument() {
  const [plan, setPlan] = useState(PLAN);
  return (
    <RichTextEditor
      label="Trip plan"
      features="full"
      value={plan}
      onChange={setPlan}
      placeholder="Write the plan…"
    />
  );
}
```

A note, with a comment's features (`features="compact"`), at `xs`: the
sizes are a field's, and set the text's floor, about two, three and four
lines.

**A short note**

```tsx
import { useState } from 'react';
import { RichTextEditor } from '@bh/richtext/editor';

export function AShortNote() {
  const [note, setNote] = useState('');
  return (
    <RichTextEditor
      label="Note"
      features="compact"
      size="xs"
      value={note}
      onChange={setNote}
      placeholder="Add a note…"
    />
  );
}
```

What it reports: the document's JSON, and `''` once it holds nothing.
A new `value` from the page replaces the document, and isn't reported
back as an edit; one the editor reported itself, even a late one, is its
own edit coming back.

**What it stores**

```tsx
import { useState } from 'react';
import { CodeBlock } from '@bh/code';
import { RichTextEditor } from '@bh/richtext/editor';

export function WhatItStores() {
  const [value, setValue] = useState('Edit **this**, and watch the value.');
  const shown = value === '' ? "''" : JSON.stringify(JSON.parse(value), null, 2);
  return (
    <div className="flex flex-col gap-12">
      <RichTextEditor label="Text" features="compact" value={value} onChange={setValue} />
      <CodeBlock lang="json" value={value.startsWith('{') ? shown : value} numbers={false} />
    </div>
  );
}
```

`readOnly` shows the text as a printed row that keeps its tab stop;
`disabled` fades it and takes it out of the tab order. Neither shows a
toolbar.

**Read only and disabled**

```tsx
import { RichTextEditor } from '@bh/richtext/editor';

const RECIPE = 'Whisk **two eggs**, then fold in the flour.';

export function ReadOnlyAndDisabled() {
  return (
    <div className="flex flex-col gap-16">
      <RichTextEditor label="Recipe, read-only" value={RECIPE} onChange={() => {}} readOnly />
      <RichTextEditor label="Recipe, disabled" value={RECIPE} onChange={() => {}} disabled />
    </div>
  );
}
```

## What its features leave out

A document holding what the editor's features leave out (a heading in a
`compact` comment, written through an API in markdown) would load empty
in Tiptap, and the next edit would write over every word of it. The
editor loads it as its plain text instead, a paragraph a line, and says
so on the console. A stored document that no longer parses shows as its
text, and is reported once.

## An app's own nodes

An app with inline nodes of its own (a chip naming one of its records)
hands the editor its rich text, made once with `createRichText` (see
[the core](core.md)). Make it outside the component: another one,
or another feature list, makes the editor again, from the text it holds.

```tsx
import { useState } from 'react';
import type { RichText } from '@bh/richtext';
import { RichTextEditor } from '@bh/richtext/editor';

// The app's rich text, made once with its nodes (see the core).
declare const richText: RichText;

export function Body() {
  const [body, setBody] = useState('');
  return (
    <RichTextEditor
      label="Body"
      richText={richText}
      features="compact"
      value={body}
      onChange={setBody}
    />
  );
}
```

## Keyboard and accessibility

The editable area is a multi-line `textbox`, named by `label` or by the
element `labelledBy` points at; `id` and `aria-describedby` land on it.
A `<label htmlFor>` can't name it, since it's no form control: point
`labelledBy` at the label's id. `tone="danger"` sets `aria-invalid`,
`readOnly` sets `aria-readonly` and keeps a tab stop, and `disabled`
sets `aria-disabled` and takes the tab stop away. Its placeholder is
`aria-placeholder` too.

The editor's own keys are Tiptap's: ⌘B, ⌘I, ⌘U and the rest of the
marks, Enter for a new block, Shift+Enter (and ⌘↩, outside a
[composer](composer.md)) for a line break, Tab and Shift+Tab in a
list to nest and lift. ⌘K opens the link popup.

## When not to use it

For text without formatting, use `Textarea`. For text that is only
read, use `Prose`, which draws a document without loading the editor.

## Props

| Prop                  | Type                                                                                                                                                                                                        | Default | Description                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` (required)    | `string`                                                                                                                                                                                                    |         | The text: a document as the editor writes it (its JSON), or markdown, which it reads as a document. Each edit is reported as the document's JSON, and an editor holding nothing reports `''`. A new value from the page replaces what it holds, and isn't reported back as an edit.                                                                                                |
| `features`            | `keyof typeof PRESETS \| readonly Feature[]`                                                                                                                                                                |         | What it can do: `full` for a document, `compact` for a comment, or the features one by one. Another list makes the editor again.                                                                                                                                                                                                                                                   |
| `richText`            | `RichText`                                                                                                                                                                                                  | `PLAIN` | The app's rich text, from `createRichText({ nodes })`, so its own inline nodes are in the editor and in the documents it reads. By default the package's, with mentions alone. Make it once, outside the component: another one makes the editor again.                                                                                                                            |
| `placeholder`         | `string`                                                                                                                                                                                                    |         | Shown while it holds nothing, disabled or read-only too.                                                                                                                                                                                                                                                                                                                           |
| `label`               | `string`                                                                                                                                                                                                    |         | Its accessible name.                                                                                                                                                                                                                                                                                                                                                               |
| `labelledBy`          | `string`                                                                                                                                                                                                    |         | The id of the element naming it, as a field's label does; wins over `label`.                                                                                                                                                                                                                                                                                                       |
| `suggestions`         | `Readonly<Record<string, SuggestionSource>>`                                                                                                                                                                |         | What each inline node's trigger suggests, by the node's name: `mention` for `@`, and an app's own by theirs (tickets' `ticketRef`, for `#`). A node with no source opens no list. Read as it is typed, so a new one needs no new editor.                                                                                                                                           |
| `slashCommands`       | `boolean \| readonly SlashCommand[]`                                                                                                                                                                        |         | The `/` list of commands: `true` for bh's own (`SLASH_COMMANDS`), or the app's list, which may hold bh's too. Only those the features allow are offered. Off by default.                                                                                                                                                                                                           |
| `uploadImage`         | `UploadImage`                                                                                                                                                                                               |         | Where images go: the app takes a file, reports how far along it is, and resolves to the address it is shown from. With the `image` feature, images pasted, dropped or picked (the toolbar's Image, `/` Image) go up through it, each held in its place, with its progress, until it is there; a failed one says so, with Retry and Remove. Without it, no image upload is offered. |
| `composer`            | `Composer`                                                                                                                                                                                                  |         | Makes it a composer, a comment box: the toolbar moves to a row under the text, beside a submit button and a ⌘↩ hint, and ⌘↩ (Ctrl+Enter elsewhere) sends the live document through `onSubmit` rather than breaking the line. Nothing sends while the text holds nothing, while pending or disabled, nor again on a held key's repeats.                                             |
| `id`                  | `string`                                                                                                                                                                                                    |         | The control's id. Where it lands, and so what a `<label htmlFor>` names, is on each control's page.                                                                                                                                                                                                                                                                                |
| `aria-describedby`    | `string`                                                                                                                                                                                                    |         | The ids of what describes the control: its help, or its problem. It lands on the element `id` does. A form's field passes it, for the description or error its wrapper draws.                                                                                                                                                                                                      |
| `onChange` (required) | `(value: T, event?: SyntheticEvent) => void`                                                                                                                                                                |         | The new value — and, second, the event that produced it where one exists.                                                                                                                                                                                                                                                                                                          |
| `size`                | `ControlSize`: `'xs'`, `'md'`, `'lg'`                                                                                                                                                                       | `'md'`  | The control's size: a field's height, padding, radius and type move together, at 30, 38 or 46 pixels.                                                                                                                                                                                                                                                                              |
| `tone`                | `Tone`: `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'` |         | The role or scale it is coloured from.                                                                                                                                                                                                                                                                                                                                             |
| `disabled`            | `boolean`                                                                                                                                                                                                   | `false` | Not applicable: removed from the tab order and from form submission.                                                                                                                                                                                                                                                                                                               |
| `readOnly`            | `boolean`                                                                                                                                                                                                   | `false` | Not editable, but still focusable and still submitted.                                                                                                                                                                                                                                                                                                                             |
| `className`           | `string`                                                                                                                                                                                                    |         | Added to the control's own classes.                                                                                                                                                                                                                                                                                                                                                |

## Types

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
interface SuggestionSource
```

Where a trigger's suggestions come from: the app's.

| Member             | Type                                                                                 | Default | Description                                                                   |
| ------------------ | ------------------------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------- |
| `items` (required) | `(query: string) => readonly SuggestionItem[] \| Promise<readonly SuggestionItem[]>` |         | The items for what is typed after the trigger, as a list or a promise of one. |
| `label`            | `string`                                                                             |         | The list's name, shown over it and read out: "People".                        |

```ts
interface SlashCommand
```

A command in the `/` list.

| Member             | Type                                                                                                                                                                                       | Default | Description                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------- |
| `id` (required)    | `string`                                                                                                                                                                                   |         | Its key in the list.                                                  |
| `label` (required) | `string`                                                                                                                                                                                   |         | What the row says.                                                    |
| `description`      | `string`                                                                                                                                                                                   |         | A quieter word after the label.                                       |
| `leading`          | `ReactNode`                                                                                                                                                                                |         | Drawn before the label.                                               |
| `keywords`         | `readonly string[]`                                                                                                                                                                        |         | More words it is found by: `h1` for Heading 1.                        |
| `feature`          | `Feature`: `'marks'`, `'link'`, `'headings'`, `'lists'`, `'taskList'`, `'blockquote'`, `'codeBlock'`, `'table'`, `'details'`, `'callout'`, `'align'`, `'image'`, `'mentions'`, `'divider'` |         | The feature it needs; an editor without it doesn't offer it.          |
| `run` (required)   | `(editor: Editor) => void`                                                                                                                                                                 |         | Runs it at the caret, where the `/` and what was typed after it were. |

```ts
type UploadImage = (file: File, progress: (percent: number) => void) => Promise<string>;
```

Where the app puts an image: it takes the file, reports how far along it is
(0 to 100) if it can, and resolves to the address the image is shown from.
A rejection is a failed upload, its message shown.

```ts
interface Composer
```

The editor as a composer, a comment box: its toolbar in a row under the
text, beside a submit button and a ⌘↩ hint, and ⌘↩ (Ctrl+Enter elsewhere)
sending the text rather than breaking the line.

| Member                | Type                      | Default | Description                                                                                                                                                                                                                                           |
| --------------------- | ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onSubmit` (required) | `(value: string) => void` |         | Sends the text: the live document's JSON, as `onChange` reports it, read at the press, so it never waits on the page to catch up. Never called while the text holds nothing. The page clears the editor, once it is sent, by setting `value` to `''`. |
| `submitLabel`         | `string`                  |         | The submit button's words. By default "Send".                                                                                                                                                                                                         |
| `submitPending`       | `boolean`                 |         | While the text is on its way: the button shows it, and nothing sends again.                                                                                                                                                                           |
| `submitDisabled`      | `boolean`                 |         | Whether sending is off: the button is, and ⌘↩ does nothing.                                                                                                                                                                                           |

```ts
type ControlSize = 'xs' | 'md' | 'lg';
```

The one size domain for every form control — 30 / 38 / 46px.

`xs` replaced `sm` in the Soft Fill redesign (2026-08-05): the bottom rung
both shrank and was renamed, because a dense table cell and a filter bar
needed something below the old 28px `sm` and the design settled the ladder at
30 / 38 / 46. Renaming rather than adding was deliberate — three rungs is the
whole domain, and a fourth would have been chosen at random by every caller.

One of `'xs'`, `'md'`, `'lg'`.

```ts
type Tone = (typeof TONE_NAMES)[number];
```

One of `'primary'`, `'secondary'`, `'success'`, `'warning'`, `'danger'`, `'neutral'`, `'red'`, `'orange'`, `'yellow'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'gray'`.
