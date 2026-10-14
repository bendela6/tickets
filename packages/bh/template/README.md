# @bh/template

What a record shows, as JSON. A table column's cell, a list item, a tile and a
card's body are all templates, drawn by the same code from the same JSON; each
host keeps a few fixed parts of its own (a card's icon and title) as plain
values, and the template is the rest. It is the display half of what
`@bh/form` is for input: a form is JSON over a registry of inputs and layouts,
a template is JSON over a registry of layouts, renderers and formatters, each
of which an app extends.

It holds no code, so a view stores it as it is; anything a template would
compute, the app adds to the record first. That is why it imports no React and
no DOM, only `@bh/resource`'s types, and sits under `packages/shared/`: a
server checks and stores a template as a browser draws it. The components that
draw one come from `@bh/ui`.

## A template

A tree (`TemplateNode`): a layout node names a registered layout, gives it its
options and holds nodes; a part is a leaf, one thing the record shows. Layouts
nest as deep as a template needs, and a template's root is a node like any
other, so a cell showing one field is one part. Any node may carry `when`, a
filter on the record (`@bh/resource`'s `Filter`), and shows, with everything in
it, only while it holds.

```json
{
  "layout": "flex",
  "options": { "direction": "column", "gap": 1 },
  "nodes": [
    {
      "layout": "flex",
      "options": { "justify": "between" },
      "nodes": [{ "field": "key" }, { "field": "status" }]
    },
    { "field": "title" },
    {
      "layout": "repeat",
      "options": { "field": "labels", "max": 3, "gap": 1 },
      "nodes": [{ "field": "labels" }]
    },
    { "field": "blockedBy", "when": { "field": "status.kind", "op": "equals", "value": "blocked" } }
  ]
}
```

## Layouts

A layout node names its layout by a string. bh's three (`BaseLayouts`):

- **`flex`** (`FlexOptions`): its nodes side by side or one under another, so a
  row, two sides and a stack are one layout. `direction` (row, column),
  `justify` (start, center, end, between), `align` (start, center, end,
  stretch, baseline), `gap` and `wrap`; a row, packed at its start, centered
  across, with no gap, when it says nothing.
- **`grid`** (`GridOptions`): its nodes in columns, row after row. `columns` is
  a count of equal ones (`2`), or a least width (`{min: 160}`), as many as fit;
  and `gap`, `align`.
- **`repeat`** (`RepeatOptions`): its nodes once per entry of a list field
  (`field`: labels, assignees, a stack's services), up to `max`, then "+N",
  laid out with flex's options. In its nodes the field holds that one entry,
  so a part showing the field shows the entry; an object entry's keys are a
  level down, 'services.name'.

A gap is a step of 4 pixels, as `@bh/ui`'s Row and Stack take it: 0, 1, 2, 3,
4, 6 or 8. An app registers its own layouts beside bh's, an overlay among them,
and types its templates with them:

```ts
import type { BaseLayouts, TemplateNode } from '@bh/template';

interface AppLayouts extends BaseLayouts {
  overlay: { anchor: 'top-end' | 'bottom-end' };
}

const avatar: TemplateNode<AppLayouts> = {
  layout: 'overlay',
  options: { anchor: 'bottom-end' },
  nodes: [{ field: 'assignee' }, { field: 'presence' }],
};
```

The layouts are a registry, as the renderers are, one set for every host. Its
half without React is here (`baseLayoutSpecs`): each layout's options' valibot
schema, whose output is its `BaseLayouts` entry, and how it lays out the nodes
it holds. flex and grid draw them once, each an item; a layout with `repeats`
draws them once per entry of the list field its options name, up to `max`,
the field holding that one entry (`entriesOf(record, field, max)` gives those
records and how many are past `max`). A layout is given its options, its
items already drawn, and `more`, the entries it counts ("+3") rather than
draws (`LayoutProps`). `@bh/ui` puts a component beside each
(`baseTemplateLayouts`), and an app spreads those and adds its own:

```ts
const layouts = {
  ...baseTemplateLayouts,
  overlay: {
    options: v.strictObject({ anchor: v.picklist(['top-end', 'bottom-end']) }),
    Component: Overlay,
  },
};
```

## Parts

A part (`Part`) shows one thing: a field (`field`: a key, or an option's
attribute, 'status.kind'), a constant (`value`: an icon's name, a separator)
or a text template (`text`: '{project}-{number}', `@bh/resource`'s
`Template`). A registered renderer draws it (`renderer`), a registered format
turns its value into text (`format`), each by its name or as
`{name, options}`, as a field's `format` names one. Its `options` are the ones
bh's renderers share: `tone` (a bh tone, by its name), `mono`, `weight` (400,
500, 600), `clamp` (the most lines), `prefix`, and `empty`, what it says while
its value is empty; without one, an empty part shows nothing and takes no room.

The id as a blue link, the title as plain text, the description clamped to
two lines:

```json
[
  {
    "field": "id",
    "renderer": { "name": "link", "options": { "to": "/items/{id}" } },
    "options": { "tone": "blue", "mono": true }
  },
  { "field": "title" },
  { "field": "description", "options": { "clamp": 2 } }
]
```

A part that names no renderer or format takes its field's, so a field shows
the same everywhere unless a template says otherwise: its kind's default
renderer, and its `format`, else its kind's. `resolvePart(part, field,
defaults)` fills them in, given the renderer registry's default for each kind
and the kinds (`createKindRegistry()`); a constant or a text template is drawn
as text. `fillText(text, show)` fills a text template with each path's value as
`show` gives it, trimmed, its runs of spaces folded, `{{` and `}}` a brace;
`textPaths(text)` names the paths it holds.

## Renderers

A registry of renderers, by the name a part gives (`renderer`), one set for
every host. Its half without React is here: each renderer's spec
(`RendererSpec`), the kinds of field it shows, its options' valibot schema and
the least width it needs (`minWidth`), so a narrow host leaves a part drawn
with it out; and what a renderer is given (`RendererProps`): its values, each
made ready as text in its format (`Shown`: its value, its text, an option's
tone, a ref's picture), its own options, the part's, the field and the record.
`@bh/ui` puts a component beside each (`baseRenderers`); an app spreads them
and adds its own, as a form's inputs are, and a server checks a template
against the specs alone.

| Renderer   | Shows                                                  | Kinds          | Options         |
| ---------- | ------------------------------------------------------ | -------------- | --------------- |
| `text`     | its text, in its format                                | any            |                 |
| `link`     | its text, to its route, or a url's to itself           | any            | `to`            |
| `pill`     | each value in a pill, an option in its color           | option, text   | `variant`       |
| `date`     | its text, with the exact day on hover                  | date, datetime |                 |
| `number`   | its text, its digits of one width                      | number         |                 |
| `avatar`   | a picture: a url's, a ref's row's, else initials       | url, ref       | `size`, `shape` |
| `user`     | a ref's row by its picture and its title               | ref            | `size`          |
| `icon`     | a glyph of @bh/ui's registry, by the value's name      | text           | `size`          |
| `progress` | a bar, the value out of `max` (100)                    | number         | `max`           |
| `meter`    | a share of `max` (1), toned by how full it is          | number         | `max`           |
| `trend`    | a change, an arrow its way, toned by whether it's good | number         | `good`          |
| `check`    | a check for true                                       | boolean        |                 |
| `code`     | JSON, or text, as code                                 | json, text     |                 |

Each of bh's kinds has a default renderer (`baseDefaultRenderers`), the one a
part showing a field of it gets when it names none: text as `text`, a url as
`link`, a number as `number`, a date or datetime as `date`, a boolean as
`check`, an option as `pill`, a ref as `user` and json as `code`. An app's
own kind adds its default beside them, and `partDefaults(renderers, kinds)`
gives `resolvePart` both:

```ts
import { createKindRegistry } from '@bh/resource';
import { baseDefaultRenderers, partDefaults, resolvePart } from '@bh/template';

const defaults = partDefaults(
  { ...baseDefaultRenderers, color: 'swatch' },
  createKindRegistry([color]),
);
resolvePart({ field: 'status' }, status, defaults); // { field: 'status', renderer: 'pill' }
```

`entryOf(registry, name)` finds an entry by its own name only, so a template
naming 'constructor' finds nothing; `named(ref)` reads a renderer or a format
named alone or as `{name, options}`; `canShow` and `fits` say whether a
renderer shows a kind and fits a width.

### Links

A link goes to its route, `to` in its options, filled from the record, so a
title or a key links to its row; without one, a url links to itself. A route
is text with field paths in braces, starting as an address does:

```json
{ "field": "key", "renderer": { "name": "link", "options": { "to": "/p/{project}/t/{number}" } } }
```

`linkTarget(to, record)` fills it: each placeholder the value its path holds
(an option its value, a ref its id), URL-encoded, so a space or a slash keeps
to its place. A placeholder whose value is empty, or a list, leaves the part
linking nowhere, as does what fills no address. `isAddress` is the one rule
for every link: absolute with its scheme, or a path from the root; never
`//…`, a relative path, or a scheme that runs code (`javascript:`, `data:`,
`vbscript:`). `isRoute` checks a `to` as link's schema does, and
`textPaths(to)` names the fields it needs. How the app's router follows the
address is the app's: `@bh/ui`'s `createLinkRenderer(Anchor)` draws its links
with the app's router link in TextLink's look.

## Hosts

A host draws a record with a template: a table column's cell, a list item, a
tile, a card's body. Each kind of host says which of its parts are fixed, set
as plain values, and where its template goes among them (`HostSpec`): its
fixed parts' valibot schema, and the parts it draws in order, with
`'template'` where the template goes. A host as a view stores it (`Host`) is
its fixed parts and its template. `defineHost` checks a kind's order names
the template once and no part twice, and types its parts by its schema's keys.
A column, a list item, a tile and a card define their own.

```ts
import * as v from 'valibot';
import { defineHost, type Host } from '@bh/template';

const card = defineHost({
  fixed: v.strictObject({ icon: v.optional(v.string()), title: v.string() }),
  order: ['icon', 'title', 'template'],
});

const hosts: Host<v.InferOutput<typeof card.fixed>> = {
  fixed: { icon: 'server', title: 'Hosts' },
  template: { field: 'name' },
};
```

## Docs

The Templates guide is in [`docs/`](docs/INDEX.md), one page so far; the docs
site (`pnpm docs:dev` in bh) shows it at `/templates/overview`.

## Layer

It depends on `@bh/resource`, for its types: a filter, a field's path and
metadata, a format, the kinds; and on valibot, for its registries' schemas. A
test holds the main entry to importing those two alone, and its tests run in
Node. `@bh/ui` is built on it.
