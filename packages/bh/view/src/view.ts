import * as v from 'valibot';
import { createOperatorRegistry, GroupBy, Json, Query, ResourceMeta, Sort } from '@bh/resource';
import type { BaseLayouts, Host, Layouts } from '@bh/template';
import {
  anyOperator,
  columnSchema,
  registeredOperator,
  type Column,
  type ColumnRegistry,
} from './column';
import { jsonObject, nameOf, namedOnce, templateOf } from './schemas';

// A view, as its author registers it: the resource it shows, the host it shows
// it in, the host's columns or item, the filters it offers and what they open
// with, its sort, its grouping, its page size and its density. What a reader
// changes (the columns shown, their order and widths, the sort, the filters,
// the groups collapsed) is its state (TK-16.4), kept apart and stored per
// view by the view's key. Checked here by its shape; against the resource's
// metadata by validateView (TK-16.5).

/**
 * The query's search and filter (@bh/resource's Query): what a filter form
 * holds as its value, what a view opens with, and what a reader's state
 * keeps. `{ search: 'login', filter: { all: [...] } }`.
 */
export const FilterValue = v.pick(Query, ['search', 'filter']);
export type FilterValue = v.InferOutput<typeof FilterValue>;

/**
 * A filter form's config: @bh/form's FormConfig, whose fields carry a
 * `filter` key saying what of the query's filter each holds (TK-75), as JSON.
 * Checked loosely here: JSON, its `nodes` a list of JSON objects. @bh/view
 * imports no @bh/form, so the FormConfig's own shape (its node kinds, each
 * field's `filter`: `{ op, field?, map? }`, `{ range }`, `{ presets }` or
 * `{ rules: true }`) is checked once TK-75 lands, by a schema of it this
 * package can take; and its inputs and operators by validateView (TK-16.5).
 * A form's `schema`, code rather than JSON, is the app's to add.
 */
export const FilterFormConfig = v.objectWithRest(
  { nodes: v.array(jsonObject('a form’s node is a JSON object')) },
  Json,
  'a filter form is its config, as JSON: { nodes: [...] }',
);
export type FilterFormConfig = v.InferOutput<typeof FilterFormConfig>;

/**
 * The filters a view offers: a filter form, and the value it opens with. The
 * form starts empty and is given the value apart, so its Clear empties it
 * rather than going back to the view's; each field shows the part of the
 * value it holds, a column's header filter too.
 */
export const ViewFilters = v.strictObject({
  /** The form a reader filters with: its search, its fields, its presets and rules. */
  form: FilterFormConfig,
  /** The search and filter the view opens with, beside its columns' filters' defaults; none when absent. */
  default: v.optional(FilterValue),
});
export type ViewFilters = v.InferOutput<typeof ViewFilters>;

/** How tightly a view's rows sit: comfortable, or compact, as @bh/ui's table has them. */
export const Density = v.picklist(['comfortable', 'compact'], 'a view is comfortable or compact');
export type Density = v.InferOutput<typeof Density>;

/** The hosts a view shows its rows in besides a table, each row an item. */
export const ItemHost = v.picklist(
  ['list', 'tiles', 'cards'],
  'a view’s host is a table, a list, tiles or cards',
);
export type ItemHost = v.InferOutput<typeof ItemHost>;

/**
 * A list's, tiles' or cards' item: a host whose fixed parts are its kind's
 * (a list item's leading picture and trailing actions, a tile's cover, a
 * card's icon and title; TK-19.1, TK-19.2 and TK-76 define them), and its
 * template. Its fixed parts are checked as JSON here, until those kinds are
 * defined.
 */
export type ViewItem<L extends Layouts<L> = BaseLayouts> = Host<Record<string, Json>, L>;

/** What every view holds, whatever its host. */
export interface ViewBase {
  /** What names it, and its state: unique among an app's views. */
  key: string;
  /** What it's called where a reader picks it: 'Open items'. */
  label: string;
  /** The resource it shows, by its name (ResourceMeta.resource): 'items'. */
  resource: string;
  /** The filters it offers; none when absent. */
  filters?: ViewFilters;
  /** Its rows' order when it opens; the resource's own (ResourceMeta.sort) when absent. */
  sort?: Sort[];
  /** Groups its rows, a band for each, by an option, ref or boolean field; none when absent. */
  group?: GroupBy;
  /** The rows a page takes, 1 to 500 (a query's `take`); the resource's own when absent. */
  pageSize?: number;
  /** How tightly its rows sit; comfortable when absent. */
  density?: Density;
}

/** A view shown in a table: its columns, in their order. */
export interface TableView<L extends Layouts<L> = BaseLayouts> extends ViewBase {
  host: 'table';
  /** Its columns, each named once by its key, in the order it shows them. */
  columns: Column<L>[];
}

/** A view shown as a list, tiles or cards: each row an item. */
export interface ItemView<L extends Layouts<L> = BaseLayouts> extends ViewBase {
  host: ItemHost;
  /** Each row's item: its kind's fixed parts, and its template. */
  item: ViewItem<L>;
}

/**
 * A view as its author registers it: a table of columns, or a list, tiles or
 * cards of items, told apart by `host`. `L` names the layouts its templates
 * may use: bh's three unless an app adds its own.
 */
export type View<L extends Layouts<L> = BaseLayouts> = TableView<L> | ItemView<L>;

/** The rows a page takes: 1 to 500, as a query's `take`. */
const pageSize = v.pipe(
  v.number(),
  v.integer('a page takes whole rows'),
  v.minValue(1, 'a page takes at least one row'),
  v.maxValue(500, 'a page takes at most 500 rows'),
);

/** A view's schema, given what checks an operator's name. */
function viewSchema<L extends Layouts<L>>(
  operator: v.GenericSchema<string>,
): v.GenericSchema<unknown, View<L>> {
  const common = {
    key: nameOf('a view is named by its key'),
    label: nameOf('a view says what it shows'),
    resource: ResourceMeta.entries.resource,
    filters: v.optional(ViewFilters),
    sort: v.optional(v.array(Sort)),
    group: v.optional(GroupBy),
    pageSize: v.optional(pageSize),
    density: v.optional(Density),
  };
  const columns = namedOnce<Column<L>>(
    v.pipe(v.array(columnSchema<L>(operator)), v.minLength(1, 'a table shows one column or more')),
    (column) => ({ key: column.fixed.key, at: ['fixed', 'key'] }),
    (key) => `two columns are "${key}"`,
  );
  return v.variant(
    'host',
    [
      v.strictObject({ ...common, host: v.literal('table'), columns }),
      v.strictObject({
        ...common,
        host: ItemHost,
        item: v.strictObject({
          fixed: jsonObject('an item’s fixed parts are a JSON object'),
          template: templateOf<L>(),
        }),
      }),
    ],
    'a view’s host is a table, a list, tiles or cards',
  );
}

/**
 * A view's schema, by its shape: an operator in a column's filter is any name
 * here; viewOf checks it's registered.
 */
export const View: v.GenericSchema<unknown, View> = viewSchema(anyOperator);

/**
 * A view's schema, its columns' filters' operators registered ones: the app's
 * registry's (createRegistry), bh's fifteen when none is given. `L` types its
 * templates' layouts as the app's.
 *
 * ```ts
 * const view = v.parse(viewOf(registry), json);
 * ```
 */
export function viewOf<L extends Layouts<L> = BaseLayouts>(
  registry: ColumnRegistry = createOperatorRegistry(),
): v.GenericSchema<unknown, View<L>> {
  return viewSchema<L>(registeredOperator(registry));
}
