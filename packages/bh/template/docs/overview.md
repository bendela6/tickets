---
title: Overview
summary: Say what a record shows as JSON, parts in layouts, for a table's cell,
  a list item, a tile or a card's body.
order: 1
related: [Building a form, The registry]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

Say what a record shows as JSON: parts laid out in layouts, nested as
deep as it needs. A table column's cell, a list item, a tile and a card's
body are all templates, drawn by the same code.

It is the display half of what `@bh/form` is for input. A form is JSON
over a registry of inputs and layouts; a template is JSON over a registry
of layouts, renderers and formatters, each of which an app extends. It
holds no code, so a view stores it as it is. The package imports no React:
a server checks and stores a template as a browser draws it.

## A template

A template is a tree. A layout node names a registered layout, gives it
its options and holds nodes; a part is a leaf, one thing the record shows.
Any node may carry `when`, a filter on the record (`@bh/resource`'s
`Filter`), and shows only while it holds. A ticket's key and title, with
its status on the right:

```json
{
  "layout": "flex",
  "options": { "justify": "between", "gap": 2 },
  "nodes": [
    {
      "layout": "flex",
      "options": { "gap": 2 },
      "nodes": [{ "field": "key" }, { "field": "title" }]
    },
    { "field": "status" }
  ]
}
```

## bh's layouts

| Layout   | Lays out its nodes                                                                         |
| -------- | ------------------------------------------------------------------------------------------ |
| `flex`   | side by side or one under another: `direction`, `justify`, `align`, `gap`, `wrap`          |
| `grid`   | in columns, a fixed count of them or as many as fit at a least width: `columns`, `gap`     |
| `repeat` | once per entry of a list field, up to `max`, then "+N": `field`, `max`, and flex's options |

A row, two sides and a stack are each a `flex`. The layouts are a
registry every host shares: each says its options' schema and how it lays
out the nodes it holds, once or once per entry of a list field.
`@bh/ui`'s `baseTemplateLayouts` draws bh's three, and an app spreads
them and registers its own beside them, an overlay among them.

## A part

A part shows a field, a constant (`value`) or a text template (`text`,
`'{project}-{number}'`). A registered renderer draws it and a registered
format turns its value into text, each named by `renderer` and `format`;
its `options` say how its text looks: `tone`, `mono`, `weight`, `clamp`,
`prefix` and `empty`. A part that names no renderer or format takes its
field's, so a field shows the same everywhere unless a template says
otherwise. The id as a blue link, the description clamped to two lines:

```json
[
  {
    "field": "id",
    "renderer": { "name": "link", "options": { "to": "/items/{id}" } },
    "options": { "tone": "blue", "mono": true }
  },
  { "field": "description", "options": { "clamp": 2 } }
]
```

## Renderers

A part's renderer is a name in a registry every host shares. bh registers
thirteen: `text`, `link`, `pill`, `date`, `number`, `avatar`, `user`,
`icon`, `progress`, `meter`, `trend`, `check` and `code`, each saying the
kinds of field it shows, the options it takes and the least width it
needs, so a narrow host leaves it out. `@bh/ui`'s `baseRenderers` draws
them; an app spreads those and adds its own. Each of bh's kinds has a
default renderer: an option shows as a pill in its color, a ref as the
row it points at, a boolean as a check, json as code, and the rest as
their text.

A link goes to its route, `to` in its options, filled from the record,
so a title or a key links to its row: `/p/{project}/t/{number}`. Each
value is URL-encoded, a value missing leaves it linking nowhere, and it
only ever goes to a path from the root or an address with a safe scheme.
Without a route, a url links to itself.

## Hosts

A host draws a record with a template, and keeps a few fixed parts of its
own, set as plain values: a card's icon and title, its body after them; a
column's header, width and sort, its cell the template. Each kind of host
says which of its parts are fixed (a valibot schema) and where its
template goes among the parts it draws.

This guide grows with the package: the formats, and `Template`, which
draws one, come next.
