---
title: Overview
summary: Rich text an app writes and stores as a document, edited with Tiptap
  and shown without it.
order: 1
related: [RichTextEditor, The core, Prose]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

Rich text an app writes and stores as a document, edited with Tiptap and
shown without it.

The package has two entries. **`@bh/richtext`** is the core, with no
React, so a server converts and searches the same text the editor
writes. **`@bh/richtext/editor`** is the editor, drawn with React on
`@bh/ui`'s field. Text that is only read is drawn by `@bh/markdown`'s
`Prose`, which walks a document as plain React and never loads Tiptap.

## Import

```tsx
import { createRichText, docToText, markdownToDoc } from '@bh/richtext';
import { RichTextEditor } from '@bh/richtext/editor';
```

An app imports the package's sheet after `@bh/ui/tokens.css`. It brings
the editor's classes and the rich text look, `.rt`, which the editor and
`Prose` both wear. An app that only shows text imports
`@bh/markdown/styles.css`, which brings `.rt` alone.

```css
@import '@bh/ui/tokens.css';
@import '@bh/richtext/styles.css';
```

## The parts

1. **[The core](core.md)**: the features an editor switches on,
   an app's own inline nodes (`createRichText`), markdown to a document
   and back, and a document's plain text.
2. **[`RichTextEditor`](editor.md)**: the editor, a bh control
   holding a document and reporting each edit as its JSON.
3. **[The toolbar](toolbar.md)**: the controls its features make,
   above the text.
4. **[Suggestions](suggestions.md)**: what `@`, an app's own
   trigger and `/` offer at the caret.
5. **[Images](image-upload.md)**: pasted, dropped or picked, each
   held in its place while it uploads.
6. **[The composer](composer.md)**: the editor as a comment box,
   its toolbar beside a submit button, and ⌘↩ to send.
7. **[`Prose`](../../markdown/docs/prose.md)**: a stored document, or markdown, drawn
   for reading in the editor's look.

## What it stores

A value is text: the editor's document as JSON, which starts
`{"type":"doc"`, or markdown, which the editor and `Prose` read as a
document. The editor reports every edit as the document's JSON, and an
editor holding nothing as `''`, so a form stores rich text in a text
column and an empty one as nothing.

## Rules

- The core imports no React, so a server takes it; the editor is its own
  entry.
- Showing text never loads the editor: `Prose` takes only the core's
  types.
- A feature's name never changes: apps store lists of them.
- A document holding what an editor's features leave out, such as a
  heading in a comment, loads as its plain text rather than empty, so
  the next edit can't write over it.
- The editor and `Prose` draw a document as the same markup, so a text
  reads as it edits.
