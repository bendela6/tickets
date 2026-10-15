# @bh/view

What a view is made of, as JSON: a resource, its host (a table, a list, tiles
or cards), the host's columns or item, its filters, its sort, its grouping, its
page size and its density. It holds no functions, so a view is stored as it
is, and it's checked with valibot, as a form (`@bh/form`'s `FormConfig`) is.
What the view's author registers, the definition, is kept apart from what a
reader changes, the state: the columns' order and which show, a width dragged,
the sort, the filters, the groups collapsed.

It imports no React and no DOM, only `@bh/resource`, `@bh/template` and
valibot, and sits under `packages/shared/` beside them: a server checks and
stores a view as a browser draws it.

## A view

A view (`View`) is what its author registers: its `key` and `label`, the
`resource` it shows, its `host`, and the host's own part, a table's
`columns` or a list's, tiles' or cards' `item`; then, each optional, the
`filters` it offers, its `sort` (`@bh/resource`'s `Sort[]`), its `group`
(`GroupBy`), its `pageSize` (1 to 500) and its `density` (`comfortable` or
`compact`).

```json
{
  "key": "open",
  "label": "Open items",
  "resource": "items",
  "host": "table",
  "columns": [{ "fixed": { "key": "name", "label": "Name" }, "template": { "field": "title" } }],
  "filters": {
    "form": { "nodes": [{ "kind": "field", "name": "search", "type": "search", "config": {} }] },
    "default": { "filter": { "all": [{ "field": "assignee", "op": "isMe" }] } }
  },
  "sort": [{ "field": "status", "dir": "asc" }],
  "group": { "field": "status.kind", "all": true },
  "pageSize": 50,
  "density": "compact"
}
```

- **`host`** tells a table (`TableView`) from a list, tiles or cards
  (`ItemView`). A table holds its `columns`, each named once by its key. The
  others hold one `item` (`ViewItem`), a host whose fixed parts are its
  kind's (a list item's, TK-19.1; a tile's, TK-19.2; a card's, TK-76),
  checked as a JSON object until those kinds define them, and its template. A
  view only names its host and holds its config; the host draws it.
- **`filters`** (`ViewFilters`) is the filter form a view offers, `form`,
  and the value it opens with, `default` (`FilterValue`, the query's
  `{ search, filter }`). The form is @bh/form's `FormConfig` as JSON, its
  fields carrying `filter` keys (TK-75); @bh/view imports no @bh/form, so it's
  checked loosely here (`FilterFormConfig`: JSON, its `nodes` JSON objects)
  until TK-75's schema of it can tighten it. The form starts empty and is
  given the value apart, so its Clear empties it; a column filter's `default`
  joins the view's when it opens.

`View` checks a view's shape, its operators any name; `viewOf(registry)`
checks each column filter's operator is registered, as `columnOf` does.
Whether its resource, fields, sorts, groups and operators are the resource's
to give, and what its templates hold, is `validateView`'s (TK-16.5).

## A column

A column is a host (`@bh/template`'s `defineHost`): a few fixed parts, set as
plain values, and its cell, a template, the same JSON a list item, a tile or a
card's body is drawn from. `columnHost` is its kind: its header draws its
`label`, the filter row under it its filter's control, and each row its cell.
A column as a view stores it (`Column`) is `{ fixed, template }`:

```json
{
  "fixed": {
    "key": "status",
    "label": "Status",
    "width": { "mode": "fixed", "size": 140, "min": 96 },
    "sort": "status",
    "filter": { "field": "status.kind", "op": "in", "control": "toggle-chips" }
  },
  "template": { "field": "status", "renderer": "pill" }
}
```

Its fixed parts (`ColumnFixed`), only `key` and `label` needed:

- **`key`**: names it in the view and in its state (its width, its place,
  whether it shows), never its label; unique in its view.
- **`label`**: what its header says.
- **`width`** (`ColumnWidth`): `fixed`, `size` pixels until a reader drags
  it; `fill`, the room left, shared alike by every fill column; or `auto`, as
  wide as its content; each with `min` and `max`, its bounds in pixels. The
  table's own width when absent.
- **`align`**: `start`, `center` or `end`, where its header and cells sit;
  `start` when absent.
- **`pinned`**: `start` or `end`, kept in sight while the rest scroll.
- **`sort`** (`ColumnSort`): a field's path, or several in order
  (`['project', 'number']`); a reader's click sorts by them all, ascending,
  then descending. It doesn't sort when absent.
- **`filter`** (`ColumnFilter`): the filter in its header, as a filter
  form's field writes one (TK-75). A condition,
  `{ field, op, control, config?, map?, default? }`, its control's value the
  operand, or what `map` turns it into (null for none); or a range,
  `{ field, range: ['gte', 'lte'], control: 'date-range', config?, default? }`,
  each half a condition while it's set. `config` is the input's own, and
  `default` its value when the view opens. The control (`FilterControl`) is one
  of the filter form's inputs that filter one field: select, multi-select,
  segmented, checkbox, toggle, text, number, date, date-range, user,
  toggle-chips, tabs or avatars.
- **`hidden`**: hidden when the view opens, until a reader shows it.

Each is a valibot schema with a type of the same name inferred from it.
`Column` checks a column's shape, its operators any name; `columnOf(registry)`
checks each operator is one the app's registry holds (`@bh/resource`'s
`createRegistry`), bh's fifteen when none is given. Each problem is reported
at its own path, every one at once:

```ts
import * as v from 'valibot';
import { createRegistry, issuesOf } from '@bh/resource';
import { columnOf } from '@bh/view';

const result = v.safeParse(columnOf(createRegistry()), json);
// issuesOf(result.issues): [{ path: ['fixed', 'filter', 'op'], message: 'no operator "between"' }]
```

The cell is checked here as JSON with a template's node at its root.
Whether a column's fields are the resource's, whether a field allows its
operator, and what its cell's parts and layouts hold is `validateView`'s
(TK-16.5), which runs `validateTemplate` (TK-79.8) on each cell.

## A view's state

A view's state (`ViewState`) is what a reader changes in it, every part
optional: a table's `columns` in the reader's order, each by its key and
whether it's `hidden` (`ColumnState`); the `widths` dragged, in pixels by
column key; the `sort`; the `filters`, the filter form's value; and the groups
`collapsed`, by the value their rows hold (`@bh/resource`'s `Group.key`). Each
part, when set, overrides what the definition sets; left out, the definition's
is used. `sort: []` is the resource's own order, and `filters: {}` filters
nothing, replacing the view's opening value and its columns' filters'
defaults alike.

```json
{
  "columns": [{ "key": "status" }, { "key": "due", "hidden": false }],
  "widths": { "status": 180 },
  "sort": [{ "field": "due", "dir": "desc" }],
  "collapsed": ["done", null]
}
```

It's stored per view, by the view's key, where the app keeps a reader's
things; `ViewStates` holds several, each under its view's key. The definition
changes under a stored state, so a state is read as it can be: a column it
names that the view no longer has is passed over, with its width, and one the
view has gained since comes after the reader's. `resolveState(view, state)`
gives what the view opens with, every part filled in from the definition, a
width within its column's bounds; `columnsOf(view, state)` gives a table's
columns in the reader's order, each one's `hidden` set.

## Docs

The Views guide is in [`docs/`](docs/INDEX.md): a view's definition, its
columns and its state. The docs site (`pnpm docs:dev` in bh) shows it at
`/views/definition`, `/views/columns` and `/views/state`.

## Layer

It depends on `@bh/resource`, for a path, an operator, a value and the
operator registry; on `@bh/template`, for its hosts and templates; and on
valibot. A test holds the main entry to importing those three alone, and its
tests run in Node.
