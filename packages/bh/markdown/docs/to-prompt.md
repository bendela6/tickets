---
title: toPrompt
summary: Write the block reference a model reads before it writes a page or a
  document, and each block's own page.
order: 9
related: [The block registry, The page editor, Writing a page]
---

[//]: # 'written from to-prompt.doc.yaml by pnpm docs:sync; edit that file, not this one'

# toPrompt

Write the block reference a model reads before it writes a page or a
document, and each block's own page.

## The block reference

`toPrompt(renderers, options)` writes every block a model may use, as
markdown, in name order: its name, its description, how it is written,
its data as JSON Schema when you pass a converter, and its examples.
`registry.toPrompt(options)` is the same over a registry's blocks. It
comes in two forms, for the two ways a page writes a block:

- **`markdown`**, the default, for a [markdown document](markdown-documents.md).
  Each block says what its body is: `YAML`, `markdown`,
  `verbatim text` or `inline mark`. Each example sits in a fence of
  four backticks or more, longer than any inside it, so the example
  can't close it.
- **`page`**, for a [YAML page](writing-a-page.md). It opens with
  how a page is written, and a short page to show it, then gives each
  block as an item: how it is written, its attributes as keys beside
  it, and each example written again as a page item through
  `pageItem`, whatever form it was authored in. One that can't be an
  item, such as an inline mark, is shown as authored.

Examples are numbered when a block has more than one, and an example's
heading rides on its label, `Example 2 — A single-line note:`, with its
note under it.

This registry holds the package's `keyboard` block, whose examples are
authored as markdown fences, and a `plant` block whose example is a
page item. The page form writes both as page items;
switch to the markdown form to see them as authored.

**Both forms**

```tsx
import { useState } from 'react';
import * as v from 'valibot';
import { CodeBlock, createRegistry, keyboardBlock, type Renderer } from '@bh/markdown';
import { SegmentedControl } from '@bh/ui';

const plantSchema = v.object({
  name: v.string(),
  light: v.picklist(['sun', 'part shade', 'shade']),
});

const plantBlock: Renderer<v.InferOutput<typeof plantSchema>> = {
  name: 'plant',
  body: 'data',
  description: 'A plant: its `name`, and the `light` it wants (sun, part shade, shade).',
  schema: plantSchema,
  attributes: {
    size: { description: 'How much room its card takes.', values: ['small', 'large'] },
  },
  examples: [['- plant:', '    name: Fern', '    light: shade', '  size: small'].join('\n')],
  component: ({ data }) => <p>{data.name}</p>,
};

// keyboard's examples are written as markdown fences; the page form
// writes them again as page items.
const registry = createRegistry([keyboardBlock, plantBlock]);

const FORMS = [
  { value: 'page', label: 'Page items' },
  { value: 'markdown', label: 'Markdown' },
];

export function BothForms() {
  const [form, setForm] = useState('page');
  const prompt = registry.toPrompt({ form: form === 'page' ? 'page' : 'markdown' });
  return (
    <div className="flex w-full flex-col gap-12">
      <SegmentedControl label="Form" options={FORMS} value={form} onChange={setForm} />
      <CodeBlock lang="markdown" value={prompt} />
    </div>
  );
}
```

## Schemas

The package reads no schema library, so `jsonSchema` is how a block's
schema reaches the reference: a function from a Standard Schema to JSON
Schema. The site passes valibot's (`@valibot/to-json-schema`), leaving
out metadata and checks across fields, which have no JSON Schema form.
Without one, the reference shows no schema.

## In the site

Block reference, on the [page editor](page-editor.md)'s bar,
copies every block the site registers in the page form, each with its
schema. Paste it into a Claude session asked to write or change a page:
it is the same registry `docs:check` reads the page with.

## Block pages

`toPage(renderer, lookup, options)` writes a block's own page, as YAML
any host reads like the pages it has files for. Its title is the block's
name and its summary the description's first sentence. Its body is the
description, how a page writes the block, a Model, its attributes, and
its examples: each in the host's live `panel` when `options.panel` names
it, else a `code` block under a heading of its own.

The Model is the block's data as a TypeScript type, printed by
`printType` from the JSON Schema `jsonSchema` gives. Each described
field carries its description as JSDoc, a `?` marks what can be left
out, and a shape it doesn't know prints as `unknown` rather than
failing:

```ts
type PlantData = {
  /** The plant, as its label names it. */
  name: string;
  /** Where it grows best. */
  light: 'sun' | 'part shade' | 'shade';
  notes?: string[];
};
```

The site serves each at `/markdown/blocks/<name>`, as
[callout](/markdown/blocks/callout), with nothing on disk and no Edit.
`demo` has none: its examples are files beside a page, so its page is
[written by hand](live-examples.md).

## Rules

- Every block has a description and an example, so the reference never
  lacks either: a registry refuses a renderer without them.
- An example that can't be written as a page item is shown as authored,
  never dropped.
- A schema is shown only through the host's converter; the package
  depends on no schema library.
- An example's fence is longer than any fence inside it.

## Reference

```ts
toPrompt(renderers: readonly AnyRenderer[], options?: PromptOptions): string
```

The block reference an authoring model reads before writing a page: each
block's name, what its body is, what it is for, and its examples. In the
page form (`form: 'page'`) a block is written as an item of a YAML page;
otherwise as markdown, each example wrapped in a fence it cannot close.

| Parameter              | Type                                           | Default | Description                                                                                                         |
| ---------------------- | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `renderers` (required) | `readonly AnyRenderer[]`                       |         |                                                                                                                     |
| `options`              | `PromptOptions`                                | `{}`    |                                                                                                                     |
| `options.jsonSchema`   | `(schema: StandardSchemaV1) => unknown`        |         | Turns a renderer's schema into JSON Schema for the prompt; omitted, no schema is shown.                             |
| `options.form`         | `'markdown' \| 'page'`: `'markdown'`, `'page'` |         | How a page writes a block: as markdown (fences and directives, the default), or as an item of a YAML page (`page`). |

Returns `string`.

```ts
interface PromptOptions
```

How `toPrompt` writes the block reference.

| Member       | Type                                           | Default | Description                                                                                                         |
| ------------ | ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `jsonSchema` | `(schema: StandardSchemaV1) => unknown`        |         | Turns a renderer's schema into JSON Schema for the prompt; omitted, no schema is shown.                             |
| `form`       | `'markdown' \| 'page'`: `'markdown'`, `'page'` |         | How a page writes a block: as markdown (fences and directives, the default), or as an item of a YAML page (`page`). |

```ts
toPage(renderer: AnyRenderer, lookup: RendererLookup, options?: ToPageOptions): string
```

A block's page, as YAML: its description and how a page writes it, its
data as a TypeScript type, its attributes, then every example under its
heading and note, live in a panel when the host has one.

| Parameter             | Type                                    | Default | Description                                                                                                                                                               |
| --------------------- | --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renderer` (required) | `AnyRenderer`                           |         |                                                                                                                                                                           |
| `lookup` (required)   | `RendererLookup`                        |         |                                                                                                                                                                           |
| `options`             | `ToPageOptions`                         | `{}`    |                                                                                                                                                                           |
| `options.jsonSchema`  | `(schema: StandardSchemaV1) => unknown` |         | Turns the block's schema into JSON Schema, for its Model; omitted, the page has none.                                                                                     |
| `options.panel`       | `string`                                |         | The block that shows a document beside its result, live. Given, each example is one, a page item in YAML (`lang: yaml`) or else markdown; omitted, each is a `code` item. |

Returns `string`.

```ts
interface ToPageOptions
```

What `toPage` takes from the host: a JSON Schema converter, and its live panel.

| Member       | Type                                    | Default | Description                                                                                                                                                               |
| ------------ | --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jsonSchema` | `(schema: StandardSchemaV1) => unknown` |         | Turns the block's schema into JSON Schema, for its Model; omitted, the page has none.                                                                                     |
| `panel`      | `string`                                |         | The block that shows a document beside its result, live. Given, each example is one, a page item in YAML (`lang: yaml`) or else markdown; omitted, each is a `code` item. |

```ts
printType(name: string, schema: unknown): string
```

`type <name> = …;`, from a JSON Schema, each described field with its JSDoc.

| Parameter           | Type      | Default | Description |
| ------------------- | --------- | ------- | ----------- |
| `name` (required)   | `string`  |         |             |
| `schema` (required) | `unknown` |         |             |

Returns `string`.
