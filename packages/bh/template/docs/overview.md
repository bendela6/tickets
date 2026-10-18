---
title: Overview
summary: A template says what a record shows, as JSON. A table cell, a list
  item, a tile and a card body are templates.
order: 1
related: [Layouts, Renderers, Formats, Building a form, The registry]
---

[//]: # 'written from overview.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Overview

A template says what a record shows, as JSON. A table cell, a list item,
a tile and a card body are all templates.

A template holds no code, so a view stores it as it is. The package has
no React: a server checks a template, a browser draws it.

## A template

A template is a tree. A layout node holds nodes; a part is a leaf. Any
node may carry `when`, a filter on the record, and shows only while it
holds.

```json
{
  "layout": "row",
  "options": { "justify": "between", "gap": 2 },
  "nodes": [
    {
      "layout": "row",
      "options": { "gap": 2 },
      "nodes": [{ "field": "key" }, { "field": "title" }]
    },
    { "field": "status" }
  ]
}
```

## A part

A part shows a field, a constant (`value`) or a text template (`text`:
`"{project}-{number}"`). Its `renderer` draws it; its `format` writes its
value. Without them, it takes its field's. Its `options` style its text:
`tone`, `mono`, `weight`, `clamp`, `prefix` and `empty`.

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

## Registries

Layouts, renderers and formats are registries. bh registers its own; an
app registers more beside them.

- [Layouts](layouts.md): `row`, `stack`, `grid`, `repeat`.
- [Renderers](renderers.md): thirteen, from `text` to `check`.
- [Formats](formats.md): eleven, from `number` to `rich`.

## Hosts

A host draws a record with a template and keeps a few fixed parts. A
card fixes its icon and title; a column fixes its header, width and sort.

## Drawing one

`@bh/ui`'s `Template` draws a template from a record and its fields. It
uses bh's registries, or an app's from a `TemplateProvider`.

- A part with nothing to show draws its `empty` text, or nothing.
- A node whose `when` fails draws nothing.
- A renderer wider than the host is left out.
- While the record loads, each part draws a placeholder.
- A ref shows the row `refOf` gives.

| Prop                  | Type                                                       | Default | Description                                                                                                           |
| --------------------- | ---------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `template` (required) | `TemplateNode`                                             |         | What it draws, as a view stores it: a part, or layouts holding parts.                                                 |
| `record`              | `Row`                                                      |         | The record it draws. None while it loads: each part then draws a placeholder in its line, so its host keeps its size. |
| `fields` (required)   | `readonly TemplateField[]`                                 |         | The record's fields, as its resource's metadata has them: each one's kind, settings and format.                       |
| `refOf`               | `(field: TemplateField, id: Id) => RefTarget \| undefined` |         | The row a ref field's id points at, by its title and picture; none → the id as text.                                  |
| `width`               | `number`                                                   |         | The host's width, in pixels: a part whose renderer needs more room is left out. None → every part shows.              |
| `viewer`              | `Scalar`                                                   |         | The signed-in user's id, for a `when` that asks whether a field holds them.                                           |
| `registry`            | `TemplateRegistry`                                         |         | Its own registry, over the provider's.                                                                                |
| `context`             | `FormatContext`                                            |         | Its own locale, time zone and now, over the provider's.                                                               |
