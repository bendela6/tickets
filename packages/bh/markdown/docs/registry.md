---
title: The block registry
summary: Register the blocks a page may use, write a block of your own, and find
  the page of each block there is.
order: 6
related: [Writing a page, Rendering a document, toPrompt]
---

[//]: # 'written from registry.doc.yaml by pnpm docs:sync; edit that file, not this one'

# The block registry

Register the blocks a page may use, write a block of your own, and find
the page of each block there is.

## A registry

A registry holds blocks by name, a `@bh/registry` registry. The
package's own blocks are `markdownBlocks`, drawn with `@bh/ui`; an app
registers its own beside them with `register`, which gives a new
registry and leaves `markdownBlocks` as it is, and `noBlocks` holds none.
`get` finds a block and throws for a name nothing registered, `has` asks
first, `names` lists them and `values()` gives them in the order
registered, which [`toPrompt`](to-prompt.md) writes the block
reference over. Registering throws on a name already taken, on a block
registered by a name other than its own, and on one with no description
or no example, since the block reference teaches a model from exactly
those. A page is read and drawn with the same registry:

```ts
import * as v from 'valibot';
import { markdownBlocks, toPrompt } from '@bh/markdown';

// Checked as it is defined; `component` is given what `schema` gives.
const plant = markdownBlocks.define({
  name: 'plant',
  body: 'data',
  description: 'A plant, by its `name`.',
  schema: v.object({ name: v.string() }),
  examples: ['- plant:\n    name: Fern'],
  component: ({ data }) => data.name,
});

// markdown's blocks and plant; markdownBlocks stays as it is.
export const registry = markdownBlocks.register({ plant });

export const prompt = toPrompt(registry.values());
```

## A block

A block is a `Renderer`:

- **`name`**: what a page names it by, unique in the registry.
- **`body`**: what is written under the name. `data` is YAML, checked
  against `schema`. `text` is kept verbatim, as `code` keeps its code.
  `markdown` is drawn with the page's own elements and blocks.
- **`schema`**: any Standard Schema, valibot's as it is. Synchronous only.
- **`description`**: one or two sentences telling a model what the block
  is and how to write it.
- **`examples`**: at least one, each as a page writes it: a page item
  (`- plant: …`) or markdown. A string, or `{ source, heading, note }`
  for a block's page to introduce it.
- **`component`**: draws it, given `data`, `attrs`, the page as `doc`,
  the host's `ctx`, and a markdown body's `children`, already drawn.
- **`attributes`** and **`main`**: the keys a page writes beside it, and
  the one it writes as the value instead of a body.
- **`toMarkdown`**: the block as plain markdown, for the copy.
- **`inline`**: written inside a sentence instead of as an item.
- **`group`**: the group the page editor's add menu sorts it into.

This app registers a `plant` block beside `markdownBlocks`: a schema for
its data, one attribute, a component, and how it reads in the copy. Set a
plant's `light` to `dark`: the problem is listed on that field's line,
and the card takes the plant's place. Switch to the copy to see
`toMarkdown` at work.

**Plant cards**

```tsx
import { useState } from 'react';
import * as v from 'valibot';
import {
  BlockErrorCard,
  CodeBlock,
  DocView,
  markdownBlocks,
  type MarkdownElements,
  pageMarkdown,
  parsePage,
  type Renderer,
} from '@bh/markdown';
import { SegmentedControl } from '@bh/ui';

const plantSchema = v.object({
  name: v.pipe(v.string(), v.description('The plant, as its label names it.')),
  light: v.pipe(v.picklist(['sun', 'part shade', 'shade']), v.description('Where it grows best.')),
  water: v.pipe(v.string(), v.description('How often to water it, in words.')),
});

type Plant = v.InferOutput<typeof plantSchema>;

const plantBlock: Renderer<Plant> = {
  name: 'plant',
  body: 'data',
  group: 'Garden',
  description:
    'A plant: its `name`, the `light` it wants (sun, part shade, shade), and how often to `water` it.',
  schema: plantSchema,
  attributes: {
    size: { description: 'How much room its card takes.', values: ['small', 'large'] },
  },
  toMarkdown: (node) => {
    const plant = node.data as Plant;
    return `- **${plant.name}**: ${plant.light}, water ${plant.water}.`;
  },
  examples: [
    ['- plant:', '    name: Fern', '    light: shade', '    water: twice a week'].join('\n'),
  ],
  component: ({ data, attrs }) => {
    const small = attrs.size === 'small';
    return (
      <div className="rounded-8 border-gray-6 bg-gray-1 mt-8 border-1 px-12 py-8">
        <p className={small ? 'text-13 font-600 text-gray-12' : 'text-15 font-600 text-gray-12'}>
          {data.name}
        </p>
        <p className="text-12/18 text-gray-11">
          {data.light} · water {data.water}
        </p>
      </div>
    );
  },
};

const registry = markdownBlocks.register({ plant: plantBlock });

const elements: MarkdownElements = {
  p: (p) => <p {...p} className="text-13/20 text-gray-11" />,
  errorCard: BlockErrorCard,
};

const PAGE = `title: Balcony
summary: What grows where on the balcony.
body:
  - |
    Three pots, from the sunny corner to the shady one.
  - plant:
      name: Rosemary
      light: sun
      water: once a week
  - plant:
      name: Mint
      light: part shade
      water: every other day
    size: small
  - plant:
      name: Fern
      light: shade
      water: twice a week
`;

const VIEWS = [
  { value: 'page', label: 'Page' },
  { value: 'copy', label: 'Markdown copy' },
];

export function PlantCards() {
  const [view, setView] = useState('page');
  const page = parsePage(PAGE, registry);
  return (
    <div className="flex w-full max-w-480 flex-col gap-12">
      <SegmentedControl label="Show" options={VIEWS} value={view} onChange={setView} />
      {view === 'page' ? (
        <DocView doc={page} registry={registry} elements={elements} />
      ) : (
        <CodeBlock lang="markdown" value={pageMarkdown(page, registry, { title: 'Balcony' })} />
      )}
      {page.issues.map((issue) => {
        return (
          <p key={`${issue.line}:${issue.message}`} className="text-12/18 text-red-11 font-mono">
            line {issue.line}: {issue.block}: {issue.message}
          </p>
        );
      })}
    </div>
  );
}
```

The component gets the data as the page wrote it, once the schema
accepts it. The schema only checks: a default or a transform in it
never reaches the component, so type the renderer with what the page
writes.

## Attributes

`attributes` names each key a block takes beside its body, with a
`description` an editor shows, and either the `values` it takes or its
`type`: `number`, or `boolean` for `true` and `false`. A YAML page allows
those keys and no others, and checks each value, so a block that
declares none takes none there. A markdown document takes any and checks
none.

However it was written, the component reads each attribute from `attrs`
as text, or as `true` for a flag. A `boolean` written `true` arrives as
`true` and one written `false` as `'false'`.

`main` names the attribute a YAML page gives as the item's value, for a
block whose body the page doesn't write: `ref`'s is `of`, so
`- ref: parsePage` is `of: parsePage`.

## Inline marks

A renderer with `inline: true` is written inside a sentence or a
heading, `:badge[stable]{tone=success}`, and never as an item: a YAML
page refuses one there. Its component gets the label in the brackets as
`data`, and the braces as `attrs`. A mark whose name no inline renderer
has stays as written.

## In the copy

`toMarkdown(node)` writes the block for the page's markdown copy: a
table, a GitHub alert, a list. Without one, a block is written as a
markdown document would write it: markdown as it is, data as a YAML
fence named for the block, text as a fence in its `lang`. For a block
whose copy is code, `fenced(info, code)` writes a fence longer than any
inside the code. An inline mark's `toMarkdown` is applied in prose and
headings, never inside code.

## A block that draws markdown

A block can draw markdown of its own with the page's elements and
blocks. `useDocContext` gives it the registry, the page, the host's
`ctx` and the elements; `renderNodes` draws nodes with them. The
callout draws its `content` this way, so a fence in a callout is a
block.

```tsx
import { useMemo } from 'react';
import { parseDocument, renderNodes, useDocContext, type Renderer } from '@bh/markdown';
import * as v from 'valibot';

const asideSchema = v.object({ title: v.string(), content: v.string() });
type AsideData = v.InferOutput<typeof asideSchema>;

function Aside({ title, content }: AsideData) {
  const { registry, elements } = useDocContext();
  const nodes = useMemo(() => parseDocument(content, registry).nodes, [content, registry]);
  return (
    <aside className="rounded-8 bg-gray-2 mt-16 px-16 py-12">
      <p className="text-15 font-600 text-gray-12">{title}</p>
      {renderNodes(nodes, elements, 'aside')}
    </aside>
  );
}

export const asideBlock: Renderer<AsideData> = {
  name: 'aside',
  body: 'data',
  description: 'An aside: a `title`, and `content` in markdown, blocks and all.',
  schema: asideSchema,
  examples: ['- aside:\n    title: In short\n    content: Two **bold** words.'],
  component: ({ data }) => <Aside {...data} />,
};
```

## The blocks

Each block has a page of its own, written by `toPage` from the block
itself: its description, how a page writes it, its data as a TypeScript
type, its attributes, and every example live in a panel.

The package's own, in `markdownBlocks`:

- [callout](/markdown/blocks/callout): an aside at one of five levels,
  its content markdown.
- [code](/markdown/blocks/code): a code fragment, coloured by its
  language, its lines numbered and marked.
- [keyboard](/markdown/blocks/keyboard): a key table, each row's keys and
  what they do.
- [badge](/markdown/blocks/badge): an inline mark, a label inside a
  sentence or a heading.
- [transcript](/markdown/blocks/transcript): a terminal session, as
  written.
- [api](/markdown/blocks/api): a resource and its HTTP routes.
- [erd](/markdown/blocks/erd): tables and their columns, wired by their
  references.
- [lifecycle](/markdown/blocks/lifecycle): a state machine, its states
  joined by their events.

The site's own, which need its plugins or its live runtime:

- [example](live-examples.md): a live example from a file beside
  the page. Its page is written by hand, since its examples are files.
- [props](/markdown/blocks/props): a component's props table, from its
  types.
- [ref](/markdown/blocks/ref): a function, hook, type or value, from its
  types and JSDoc.
- [variants](/markdown/blocks/variants): every combination of two of a
  component's props.
- [tokens](/markdown/blocks/tokens): one family of `@bh/ui`'s tokens,
  each with a specimen.
- [panel](/markdown/blocks/panel): a document beside what it renders
  to, both live.

## Rules

- A name is unique in a registry: registering it twice throws.
- Every renderer has a description and at least one example, or
  registering it throws.
- A YAML page allows a block only the attributes it declares, and
  checks their values; a markdown document checks none.
- A component reads attributes as text, or `true` for a flag.
- A data block's component gets its data as written, after the schema
  accepts it; data the schema refuses draws the error card instead.
- An inline mark is never an item of its own.

## Reference

```ts
const noBlocks: Registry<
  Renderer<any>,
  <T>(renderer: Renderer<T>) => Renderer<any>,
  Record<never, Renderer<any>>
>;
```

A registry holding no blocks, for a page that draws none of this package's:
`noBlocks.register({ plant })`. `define` types a block by its schema, so
its component is given what that schema gives.

```ts
type Registry = RegistryOf<AnyRenderer>;
```

The blocks a page may use, by name: `markdownBlocks`, or a registry with an
app's own beside them (`markdownBlocks.register({ plant })`). `get` throws
for a name nothing registered; `has` asks first.

| Member               | Type                            | Default | Description                                                                     |
| -------------------- | ------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `name` (required)    | `string`                        |         | What an entry is called, in messages: 'renderer'.                               |
| `names` (required)   | `readonly string[]`             |         | Its entries' names, in the order they were registered.                          |
| `get` (required)     | `(name: string) => AnyRenderer` |         | The entry by its name. Throws, saying which names it holds, for one it doesn't. |
| `has` (required)     | `(name: string) => boolean`     |         | Whether it holds an entry by this name.                                         |
| `values` (required)  | `() => AnyRenderer[]`           |         | Its entries, in the order they were registered.                                 |
| `entries` (required) | `() => [string, AnyRenderer][]` |         | Its entries with their names, in the order they were registered.                |

```ts
type RendererLookup = Pick<Registry, 'get' | 'has' | 'names'>;
```

What reading a page needs of a registry: its blocks, by name.

| Member             | Type                            | Default | Description                                                                     |
| ------------------ | ------------------------------- | ------- | ------------------------------------------------------------------------------- |
| `names` (required) | `readonly string[]`             |         | Its entries' names, in the order they were registered.                          |
| `get` (required)   | `(name: string) => AnyRenderer` |         | The entry by its name. Throws, saying which names it holds, for one it doesn't. |
| `has` (required)   | `(name: string) => boolean`     |         | Whether it holds an entry by this name.                                         |

```ts
type AnyRenderer = Renderer<any>;
```

A renderer of any data shape. A registry holds renderers of different
shapes side by side, and `component` takes its data as a parameter, so no
narrower type admits them all.

| Member                   | Type                                                               | Default | Description                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name` (required)        | `string`                                                           |         | What a page names it by: `- callout:`, ```callout, `:::callout`. Unique in a registry.                                                                                                       |
| `body` (required)        | `'data' \| 'markdown' \| 'text'`: `'data'`, `'markdown'`, `'text'` |         | What its body is: YAML data, checked against `schema`; markdown, drawn with the page's own elements and blocks; or text, kept verbatim.                                                      |
| `inline`                 | `boolean`                                                          |         | Written inside prose as `:name[label]{attrs}` rather than as a block of its own; its component gets the label as `data`.                                                                     |
| `group`                  | `string`                                                           |         | Which group it is listed under, as the page editor's add menu lists blocks. Free-form; blocks that name no group are listed together at the end.                                             |
| `description` (required) | `string`                                                           |         | One or two sentences telling an authoring model what the block is and how to write it.                                                                                                       |
| `schema`                 | `StandardSchemaV1<T>`                                              |         | Checks a data block's body: any Standard Schema, valibot's as it is. Synchronous only; a block whose data fails it draws the error card.                                                     |
| `attributes`             | `Record<string, Attribute>`                                        |         | The attributes it takes. A YAML page allows these and no others, so a block that declares none takes none there; markdown doesn't check them.                                                |
| `main`                   | `string`                                                           |         | The attribute a YAML page's item gives by value, for a block whose body the page doesn't write: `- props: Button` is `of: Button`.                                                           |
| `toMarkdown`             | `(node: BlockNode) => string`                                      |         | The block as plain markdown, for a YAML page's markdown copy: what GitHub, an editor's preview and a Claude session read. Omitted, a block is written as a markdown document would write it. |
| `examples` (required)    | `Example[]`                                                        |         | How a page writes it, at least one: what `toPrompt` teaches a model from, what a block's page shows, and what the page editor starts a new one from.                                         |
| `component` (required)   | `ComponentType<BlockProps<T>>`                                     |         | Draws it, given its body, its attributes, the page and the host's context.                                                                                                                   |

```ts
interface BlockProps<T>
```

What a renderer's component is handed.

| Member             | Type            | Default | Description                                                                                             |
| ------------------ | --------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `data` (required)  | `T`             |         | Its body: a data block's data, checked against the schema; a text block's text; an inline mark's label. |
| `attrs` (required) | `Attrs`         |         | Its attributes, each as text, or `true` for a bare flag.                                                |
| `doc` (required)   | `Doc`           |         | The page it is drawn in.                                                                                |
| `ctx` (required)   | `RenderContext` |         | What the host handed `DocView`.                                                                         |
| `children`         | `ReactNode`     |         | A markdown block's body, drawn with the page's elements and blocks.                                     |

```ts
interface Attribute
```

One attribute a block takes, as a YAML page checks it and an editor offers
it. The component still reads it from `attrs`, as text.

| Member                   | Type                                             | Default | Description                                               |
| ------------------------ | ------------------------------------------------ | ------- | --------------------------------------------------------- |
| `description` (required) | `string`                                         |         | What it does, in a sentence: an editor shows it on hover. |
| `values`                 | `readonly string[]`                              |         | The values it takes; omitted, any text.                   |
| `type`                   | `'number' \| 'boolean'`: `'number'`, `'boolean'` |         | A number or a yes/no rather than text.                    |

```ts
type Example = string | HeadedExample;
```

One example of a block, as authored.

A bare string is the shorthand: the source, with no prose around it. That is
all a test fixture or a one-off block needs. The long form adds what a
gallery needs to introduce an example. Both forms are normalised by
`toExample`, so no consumer handles the union.

```ts
interface HeadedExample
```

The long form of an example: its source, and the prose a gallery shows above it.

| Member               | Type     | Default | Description                                                           |
| -------------------- | -------- | ------- | --------------------------------------------------------------------- |
| `source` (required)  | `string` |         | The block as a page writes it: a page item (`- name: …`) or markdown. |
| `heading` (required) | `string` |         | What this example demonstrates, as a sentence-case phrase.            |
| `note`               | `string` |         | One line under the heading. Omit when the heading says enough.        |

```ts
toExample(example: Example): NormalizedExample
```

The long form of an example, whichever form it was authored in.

| Parameter            | Type      | Default | Description |
| -------------------- | --------- | ------- | ----------- |
| `example` (required) | `Example` |         |             |

Returns `NormalizedExample`.

```ts
interface BlockNode
```

A block in a parsed page: its name, its attributes, and its body as its
renderer reads it: `data` for a data block, `text` for a text block,
`children` for a markdown one.

| Member             | Type      | Default | Description                                                                                                                   |
| ------------------ | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `type` (required)  | `'block'` |         |                                                                                                                               |
| `name` (required)  | `string`  |         | Its renderer's name.                                                                                                          |
| `attrs` (required) | `Attrs`   |         | Its attributes, each as text, or `true` for a bare flag.                                                                      |
| `data`             | `unknown` |         | A data block's body, parsed from YAML.                                                                                        |
| `text`             | `string`  |         | A text block's body, verbatim; a YAML page's markdown block keeps its text here too.                                          |
| `children`         | `Node[]`  |         | A markdown block's body, parsed: prose and the blocks inside it.                                                              |
| `line` (required)  | `number`  |         | The line it starts on, from 1.                                                                                                |
| `bodyLine`         | `number`  |         | The line its text starts on. A fence's starts on the next line; a YAML page's may start on the same one (`- code: import …`). |
| `parseFailed`      | `boolean` |         | Set when the YAML body failed to parse, so validation does not also report schema errors against the `{}` fallback.           |

```ts
type Node = BlockNode | RootContent;
```

A block, or an mdast node as the markdown parser produced it. Blocks sit
only in a page's own list and in a block's markdown body; an mdast node's
children are mdast all the way down.

```ts
isBlockNode(node: Node): node is BlockNode
```

Whether a node is a block rather than markdown.

| Parameter         | Type   | Default | Description |
| ----------------- | ------ | ------- | ----------- |
| `node` (required) | `Node` |         |             |

Returns `node is BlockNode`.

```ts
useDocContext(): DocContextValue
```

The page a block is drawn in; a block renderer reads it to walk its own nodes.

Returns `DocContextValue`.

```ts
interface DocContextValue
```

What `useDocContext` gives a block: the page it is in, and what it is drawn with.

| Member                   | Type                      | Default | Description                                                                     |
| ------------------------ | ------------------------- | ------- | ------------------------------------------------------------------------------- |
| `registry` (required)    | `Registry`                |         | The blocks the page is drawn with, for a block that parses markdown of its own. |
| `doc` (required)         | `Doc`                     |         | The page being drawn.                                                           |
| `ctx` (required)         | `RenderContext`           |         | What the host handed `DocView`.                                                 |
| `definitions` (required) | `Map<string, Definition>` |         | The page's link definitions (`[id]: /url`), by identifier.                      |
| `elements` (required)    | `MarkdownElements`        |         | The host's elements, to draw nodes with: `renderNodes(nodes, elements)`.        |

```ts
renderNodes(nodes: readonly (Node | Nodes)[] | undefined, elements: MarkdownElements, keyPrefix?: string): ReactNode
```

Draws a list of nodes with the host's elements; a block renderer calls it for its own.

| Parameter             | Type                                      | Default | Description |
| --------------------- | ----------------------------------------- | ------- | ----------- |
| `nodes` (required)    | `readonly (Node \| Nodes)[] \| undefined` |         |             |
| `elements` (required) | `MarkdownElements`                        |         |             |
| `keyPrefix`           | `string`                                  | `'n'`   |             |

Returns `ReactNode`.

```ts
fenced(info: string, code: string): string
```

Code in a fence, longer than any run of backticks inside it.

| Parameter         | Type     | Default | Description |
| ----------------- | -------- | ------- | ----------- |
| `info` (required) | `string` |         |             |
| `code` (required) | `string` |         |             |

Returns `string`.
