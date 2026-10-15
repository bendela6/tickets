---
title: A view's state
summary: "Keep what a reader changes in a view apart from its definition: its
  columns' order and which show, their widths, the sort, the filters and the
  groups collapsed, stored per view."
order: 3
related: [A view's definition, Columns]
---

[//]: # 'written from state.doc.yaml by pnpm docs:sync; edit that file, not this one'

# A view's state

Keep what a reader changes in a view apart from its definition: its
columns' order and which show, their widths, the sort, the filters and
the groups collapsed, stored per view.

A view's author registers its definition ([A view's
definition](definition.md)); a reader changes its state. Each part of
the state, when it is set, overrides what the definition sets, and each
part left out is the definition's. The state is JSON, as the view is, and
holds nothing but what the reader changed. Every type this page names is
defined under [Types](#types).

## A state

A reader of a table of open items who moved the status to the front,
showed the due date and hid the name; dragged the status wider; sorted
by the due date, latest first; searched for a word among their own
items; and collapsed the done ones and those with no status:

```json
{
  "columns": [
    { "key": "status" },
    { "key": "due", "hidden": false },
    { "key": "name", "hidden": true }
  ],
  "widths": { "status": 180 },
  "sort": [{ "field": "due", "dir": "desc" }],
  "filters": {
    "search": "login",
    "filter": { "all": [{ "field": "owner", "op": "isMe" }] }
  },
  "collapsed": ["done", null]
}
```

## Its parts

Every part is optional, and each one that is set overrides the view's:

| Part        | What it is                                                             | When absent       |
| ----------- | ---------------------------------------------------------------------- | ----------------- |
| `columns`   | a table's columns in the reader's order, each by its key, and `hidden` | the view's order  |
| `widths`    | the widths the reader dragged, in pixels, by column key                | each column's own |
| `sort`      | its rows' order; `[]` for the resource's own                           | the view's sort   |
| `filters`   | the search and filter the reader set, the whole of them; `{}` for none | the view's own    |
| `collapsed` | the keys of the groups the reader collapsed, each once                 | none collapsed    |

### Columns and widths

`columns` names a table's columns by their keys, in the order the reader
put them, each once. A column's `hidden` is the reader's: hidden, or
shown; left out, it is as the view sets it. `widths` keeps each width the
reader dragged by its column's key, and it wins over the column's own
width, within the column's `min` and `max`. A column's place, whether it
shows and its width are kept by its key, never its label
([Columns](columns.md)).

### Sort and filters

`sort` is a list of keys, as a view's sort is, and it replaces the
view's: `[]` sorts by the resource's own order. `filters` is the filter
form's value, `{ search, filter }`, and it replaces the whole of what the
view opens with: its filters' `default` and its columns' filters'
defaults. `{}` filters nothing; left out, the view opens with its own.

### Collapsed groups

`collapsed` lists the groups a reader folded, by the value their rows
hold, as the resource's answer keys its groups: `null` for the rows that
hold none, and `1` told from `"1"`. It counts only in a view that groups.

## Stored per view

A state is kept by its view's key, where the app keeps a reader's
things: on its server, for a reader to find on any of their devices, or
in the browser. `ViewStates` holds them together, each under its view's
key; an app may as well keep each by itself under its view's key.

```json
{
  "open": { "widths": { "status": 180 } },
  "board": { "collapsed": ["done"] }
}
```

The view's definition changes under a stored state, and the state is
read as it can be rather than refused: a column it names that the view
no longer has is passed over, with its width, and a column the view has
gained since comes after the reader's, as the view sets it.

## Opening a view

`resolveState(view, state)` lays a state over its view and gives what
the view opens with: every column of a table in the reader's order and
then the view's, each one's `hidden` worked out; the widths of the
columns the view has, each within its bounds; the sort; the reader's
filters, or none, for the view's own; and the groups collapsed.
`columnsOf(view, state)` gives a table's columns themselves, in that
order, each with its `hidden` set.

```ts
import * as v from 'valibot';
import { columnsOf, resolveState, ViewState, type TableView } from '@bh/view';

declare const view: TableView;
declare const stored: string;

const state = v.parse(ViewState, JSON.parse(stored));
const opened = resolveState(view, state);
// opened.columns: [{ key: 'status', hidden: false }, ...]
// opened.widths: { status: 180 }
const columns = columnsOf(view, state);
console.log(opened.sort, columns.length);
```

The table takes the widths, the sort and the groups collapsed as its own
state, and the filter form the filters as its value; with none, the form
puts the view's own opening value together from its filters' and its
columns' defaults. A state is checked by its shape, each problem at its
own path, as a view is; whether its fields sort is the resource's to
say, when the query is asked.

## Types

Every type above, as the package exports it. `ViewState`, `ColumnState`
and `ViewStates` are also valibot schemas of the same names.

```ts
import type * as v from 'valibot';
import type { Filter, Scalar, Sort } from '@bh/resource';
import type { Column, TableView, View } from '@bh/view';

/** What a reader changes in a view; each part, set, overrides the view's. */
export interface ViewState {
  /** A table's columns in the reader's order, each once. */
  columns?: ColumnState[];
  /** Dragged widths, in pixels, by column key. */
  widths?: Record<string, number>;
  /** Its rows' order; [] for the resource's own. */
  sort?: Sort[];
  /** The reader's search and filter, the whole of them; {} for none. */
  filters?: FilterValue;
  /** The groups collapsed, by the value their rows hold. */
  collapsed?: (Scalar | null)[];
}

/** A column as the reader placed it. */
export interface ColumnState {
  key: string;
  /** As the view sets it when absent. */
  hidden?: boolean;
}

/** A filter form's value: the query's search and filter. */
export interface FilterValue {
  search?: string;
  filter?: Filter;
}

/** A reader's states, each by its view's key. */
export type ViewStates = Record<string, ViewState>;

/** A state over its view's definition: what the view opens with. */
export interface ResolvedState {
  /** Every column of a table: the reader's order, then the view's. */
  columns: { key: string; hidden: boolean }[];
  /** The widths of the columns the view has, within their bounds. */
  widths: Record<string, number>;
  sort: Sort[];
  /** Absent: the view opens with its own. */
  filters?: FilterValue;
  /** [] when the view doesn't group. */
  collapsed: (Scalar | null)[];
}

/** A state's schema. */
export declare const ViewState: v.GenericSchema<unknown, ViewState>;

/** What a view opens with: its stored state over its definition. */
export declare function resolveState(view: View, state?: ViewState): ResolvedState;

/** A table's columns as its reader left them. */
export declare function columnsOf(view: TableView, state?: ViewState): Column[];
```

### From the pages and packages under it

A view, a table view and a column, from [A view's
definition](definition.md) and [Columns](columns.md); a sort, a
filter and a value from `@bh/resource`, as [The resource
contract](../../resource/docs/contract.md) defines them. Each is written out whole
on its own page; here, in short.

```ts
/** A view: a table of columns, or a list, tiles or cards of items. */
export type View = TableView | { host: 'list' | 'tiles' | 'cards' };

/** A view shown in a table: its columns, in their order. */
export interface TableView {
  host: 'table';
  columns: Column[];
}

/** A table's column: its fixed parts, and its cell, a template. */
export interface Column {
  /** And its align, pinned, sort and filter, on Columns. */
  fixed: {
    key: string;
    label: string;
    /** Hidden when the view opens, until a reader shows it. */
    hidden?: boolean;
    /** Its width: a dragged one stays within its min and max. */
    width?: { mode: 'fixed' | 'fill' | 'auto'; min?: number; max?: number };
  };
  template: { [key: string]: Json };
}

/** One key of an order. */
export interface Sort {
  field: string;
  dir: 'asc' | 'desc';
}

/** Which rows: conditions on their fields, joined by all, any and not. */
export type Filter =
  | { all: Filter[] }
  | { any: Filter[] }
  | { not: Filter }
  | { field: string; op: string; value?: Scalar | Scalar[] };

/** One value: text, a finite number, or a boolean. */
export type Scalar = string | number | boolean;

/** Any JSON value. */
export type Json = null | Scalar | Json[] | { [key: string]: Json };
```
