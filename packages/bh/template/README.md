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
no DOM, only `@bh/resource`'s types and `@bh/registry`, and sits under `packages/shared/`: a
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
  "layout": "stack",
  "options": { "gap": 1 },
  "nodes": [
    {
      "layout": "row",
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

A layout node names its layout by a string. bh's four are `@bh/ui`'s
(`BaseLayouts`):

- **`row`** (`RowOptions`): its nodes side by side. `justify` (start, center,
  end, between), `align` (start, center, end, stretch, baseline), `gap` and
  `wrap`. Default: packed at the start, centered across, no gap.
- **`stack`** (`StackOptions`): its nodes one under another. `align` (start,
  center, end, stretch) and `gap`. Default: stretched across, no gap.
- **`grid`** (`GridOptions`): its nodes in columns, row after row. `columns` is
  a count of equal ones (`2`), or a least width (`{min: 160}`), as many as fit;
  and `gap`, `align`.
- **`repeat`** (`RepeatOptions`): its nodes once per entry of a list field
  (`field`: labels, assignees, a stack's services), up to `max`, then "+N",
  in a row, with row's options. In its nodes the field holds that one entry,
  so a part showing the field shows the entry; an object entry's keys are a
  level down, 'services.name'.

A gap is a step of 4 pixels, as `@bh/ui`'s Row and Stack take it: 0, 1, 2, 3,
4, 6 or 8. An untyped template takes any layout. An app types its templates with
its own layouts:

```ts
import type { TemplateNode } from '@bh/template';
import type { BaseLayouts } from '@bh/ui';

interface AppLayouts extends BaseLayouts {
  overlay: { anchor: 'top-end' | 'bottom-end' };
}

const avatar: TemplateNode<AppLayouts> = {
  layout: 'overlay',
  options: { anchor: 'bottom-end' },
  nodes: [{ field: 'assignee' }, { field: 'presence' }],
};
```

The layouts are a registry, one set for every host: `@bh/ui`'s
`baseTemplateLayouts`. Each layout is one file: its options' valibot schema,
its component and its entry. row, stack and grid draw their nodes once; a
layout with `repeats` draws them once per entry of a list field, up to `max`
(`entriesOf(record, field, max)`). A layout gets its options, its items
already drawn, and `more`, the entries past `max` (`LayoutProps`). An app
defines its own with `defineTemplateLayout` and registers it with `register`,
which gives a new registry:

```ts
const layouts = baseTemplateLayouts.register({
  overlay: defineTemplateLayout({
    options: v.strictObject({ anchor: v.picklist(['top-end', 'bottom-end']) }),
    Component: Overlay,
  }),
});
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
and the kinds (`baseKinds`); a constant or a text template is drawn
as text. `fillText(text, show)` fills a text template with each path's value as
`show` gives it, trimmed, its runs of spaces folded, `{{` and `}}` a brace;
`textPaths(text)` names the paths it holds.

## Renderers

A registry of renderers, by the name a part gives (`renderer`), one set for
every host: `@bh/ui`'s `baseRenderers`. Each renderer is one file: the kinds
it shows, its options' valibot schema, its least width (`minWidth`), its
component and its entry. A renderer gets `RendererProps`: its values, each
ready as text in its format (`Shown`), its own options, the part's, the field
and the record. An app defines its own with `defineRenderer` and registers it with
`baseRenderers.register`.

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

Each of bh's kinds has a default renderer (`@bh/ui`'s `baseDefaultRenderers`), the one a
part showing a field of it gets when it names none: text as `text`, a url as
`link`, a number as `number`, a date or datetime as `date`, a boolean as
`check`, an option as `pill`, a ref as `user` and json as `code`. An app's
own kind adds its default beside them, and `partDefaults(renderers, kinds)`
gives `resolvePart` both:

```ts
import { baseKinds } from '@bh/resource';
import { partDefaults, resolvePart } from '@bh/template';
import { baseDefaultRenderers } from '@bh/ui';

const defaults = partDefaults(
  { ...baseDefaultRenderers, color: 'swatch' },
  baseKinds.register({ color }),
);
resolvePart({ field: 'status' }, status, defaults); // { field: 'status', renderer: 'pill' }
```

`entryOf(record, name)` finds an entry of a plain record, as the kinds'
defaults, by its own name only, so a kind named 'constructor' finds nothing; `named(ref)` reads a renderer or a format
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

## Formats

A registry of formats, by the name a field's `format` or a part's `format`
gives, one set for every host and for a server as for a browser. A format
turns a value into the text a renderer shows. Each entry (`Formatter`) is its
function and its spec, `@bh/resource`'s `FormatSpec`: its name, the kinds it
takes and its options' valibot schema. The function is called with the value,
its options (the schema's output, `{}` when it takes none) and the app's
context, the locale and time zone it sets once and the moment `relative`
counts from (`FormatContext`), and answers with pieces (`FormatPiece`), as
`Intl`'s `formatToParts` does:

```ts
import { baseFormats, formatText, formatValue } from '@bh/template';

const pieces = formatValue(baseFormats, { name: 'bytes', options: { per: 's' } }, 13_002_342);
// [{ text: '12.4' }, { text: ' ' }, { text: 'MiB/s', unit: true }]
formatText(pieces); // '12.4 MiB/s', for a filter chip, a tooltip, an export, an MCP answer
```

A unit is a piece with `unit: true`, so a card draws it smaller than its
number and a cell joins them. bh registers eleven (`baseFormats`):

| Format     | Writes                                      | Kinds                                   | Options                         |
| ---------- | ------------------------------------------- | --------------------------------------- | ------------------------------- |
| `number`   | `1,234.5`, compact `12.4K`                  | number                                  | `digits`, `notation: 'compact'` |
| `percent`  | a fraction as a percent: 0.427 is `43%`     | number                                  | `digits`                        |
| `bytes`    | `12.4 MiB`, as a rate `12.4 MiB/s`          | number                                  | `units`, `digits`, `per`        |
| `duration` | `2h 5m`, `840ms`                            | number                                  | `unit`, `days`                  |
| `money`    | `€12.50`                                    | number                                  | `currency` (required)           |
| `date`     | `Jul 13, 2026`, the UTC day                 | date                                    |                                 |
| `datetime` | `Jul 13, 2026, 09:05`                       | datetime                                | `timeZone`                      |
| `relative` | `5 minutes ago`, `in 2 hours`, `3 days ago` | date, datetime                          | `smallestUnit`                  |
| `plain`    | the text as it is                           | text, markdown, url, email, phone, time |                                 |
| `markdown` | markdown as the text it reads as            | markdown, text                          |                                 |
| `rich`     | a rich text's words, a block to a line      | richtext                                |                                 |

`digits` is the most digits after the point, and a whole amount drops its
zeros; `percent` takes a fraction; `duration` reads its number in `unit` (`ms`,
`s`, `min` or `h`, minutes unless given). A format's `timeZone` wins over the
context's. `markdown` and `rich` are the default formats of the markdown and
richtext kinds: they write the words of the text, so a cell shows neither
marks nor JSON. A value in no format, in one nothing registered, or with
options its schema refuses is its own text (`formatValue`), so a stored
mistake shows and takes nothing down.

`baseFormats` is a registry (`@bh/registry`), as the renderers are: an app
defines its own with `defineFormat`, which checks it and types its function by
its options' schema, registers it beside bh's with `register`, and passes them to
the resource's registry (`values()`), which checks each field's format and its
options. `checkFormats(formats, kinds)` checks the formats against the kinds:
each kind's default format (`KindSpec.format`) registered and taking that kind:

```ts
import * as v from 'valibot';
import { createRegistry } from '@bh/resource';
import { baseFormats, checkFormats, defineFormat } from '@bh/template';

// All its options optional: the schema takes `undefined` too, so `format: 'rate'` alone is valid.
const options = v.optional(v.strictObject({ per: v.optional(v.picklist(['page', 'visit'])) }), {});

const rate = defineFormat({
  name: 'rate',
  kinds: ['number'],
  options,
  format: (value, { per = 'page' }) => [
    { text: String(value) },
    { text: ` per ${per}`, unit: true },
  ],
});

const formats = baseFormats.register({ rate });
checkFormats(formats);
const registry = createRegistry({ formats });
```

The pure functions the formats write with live here too, so a server formats
as a browser does: `formatBytes`, `formatDuration`, `formatDateTime`,
`formatExact` and `relativeLabel`. `@bh/ui` exports them by the same names.

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

The Templates guide is in [`docs/`](docs/INDEX.md), two pages so far, the
overview and the formats; the docs site (`pnpm docs:dev` in bh) shows them at
`/templates/overview` and `/templates/formats`.

## Layer

It depends on `@bh/resource`, for its types: a filter, a field's path and
metadata, a format, the kinds; and on valibot, for its registries' schemas. A
test holds the main entry to importing those two alone, and its tests run in
Node. `@bh/ui` is built on it.
