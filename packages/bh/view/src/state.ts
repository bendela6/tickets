import * as v from 'valibot';
import { Scalar, Sort } from '@bh/resource';
import type { AnyLayouts, Layouts } from '@bh/template';
import type { Column } from './column';
import { nameOf, namedOnce, pixels, recordOf } from './schemas';
import { FilterValue, type TableView, type View } from './view';

// A view's state: what a reader changes in it, kept apart from what its author
// registers (the definition, View). Its table's columns in the reader's order
// and which are hidden, the widths dragged, the sort, the filters and the
// groups collapsed; each, when set, overrides what the definition sets, and
// each left out is the definition's. It is stored per view, by the view's key,
// where the app keeps a reader's things. A view's definition changes under a
// stored state, so a state is read as it can be: a column it names that the
// view no longer has is passed over, and one the view has gained since takes
// its place after the reader's.

/** One of a table's columns as the reader placed it: by its key, and whether it's hidden. */
export const ColumnState = v.strictObject({
  /** The column's key in the view. */
  key: nameOf('a column is named by its key'),
  /** Hidden by the reader, or shown; as the view sets it when absent. */
  hidden: v.optional(v.boolean()),
});
export type ColumnState = v.InferOutput<typeof ColumnState>;

/** A group's key, the value its rows hold (@bh/resource's Group.key): null for the rows that hold none. */
const groupKey = v.nullable(Scalar);

/** Whether a list holds each value once, null and each scalar told apart. */
function eachOnce(values: (Scalar | null)[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * What a reader changes in a view. Each part, when set, overrides the view's
 * definition; absent, the view's is used.
 *
 * ```json
 * {
 *   "columns": [{ "key": "status" }, { "key": "name" }, { "key": "due", "hidden": false }],
 *   "widths": { "status": 180 },
 *   "sort": [{ "field": "due", "dir": "desc" }],
 *   "filters": { "search": "login" },
 *   "collapsed": ["done", null]
 * }
 * ```
 */
export const ViewState = v.strictObject({
  /**
   * A table's columns in the reader's order, each named once by its key, and
   * whether each is hidden. The view's own order when absent.
   */
  columns: v.optional(
    namedOnce(
      v.array(ColumnState),
      (column) => ({ key: column.key, at: ['key'] }),
      (key) => `the column "${key}" is placed twice`,
    ),
  ),
  /**
   * The widths the reader dragged, in pixels, by column key: each wins over
   * its column's own width, within its bounds. None when absent.
   */
  widths: v.optional(recordOf(pixels, 'widths are pixels by column key: { "status": 180 }')),
  /** Its rows' order; the view's sort when absent, the resource's own when []. */
  sort: v.optional(v.array(Sort)),
  /**
   * The search and filter the reader set, the whole of them: they replace the
   * view's opening value and its columns' filters' defaults. The view's own
   * when absent; nothing filters when {}.
   */
  filters: v.optional(FilterValue),
  /** The keys of the groups the reader collapsed, each once; none when absent. */
  collapsed: v.optional(v.pipe(v.array(groupKey), v.check(eachOnce, 'a group is collapsed once'))),
});
export type ViewState = v.InferOutput<typeof ViewState>;

/**
 * A reader's states, each by its view's key: `{ "open": { ... } }`. One way
 * to store them together; an app may as well store each by itself under its
 * view's key.
 */
export const ViewStates = recordOf(ViewState, 'a reader’s states are by view key: { "open": {} }');
export type ViewStates = v.InferOutput<typeof ViewStates>;

/** A view's state with the view's definition filled in: what the view opens with. */
export interface ResolvedState {
  /** Every column of a table, in the reader's order and then the view's; [] for any other host. */
  columns: { key: string; hidden: boolean }[];
  /** The dragged widths of the columns the view has, each within its column's bounds. */
  widths: Record<string, number>;
  /** The reader's sort, or the view's; [] for the resource's own order. */
  sort: Sort[];
  /**
   * The reader's search and filter; absent, the view opens with its own: its
   * filters' default and its columns' filters' defaults, as its filter form
   * puts them together.
   */
  filters?: FilterValue;
  /** The groups collapsed; [] when the view doesn't group. */
  collapsed: (Scalar | null)[];
}

/** The columns of a view: a table's, and none for a list, tiles or cards. */
function columnsIn<L extends Layouts<L>>(view: View<L>): Column<L>[] {
  return view.host === 'table' ? view.columns : [];
}

/**
 * What a view opens with: its stored `state` over its definition. A column
 * the state names that the view no longer has is passed over, and so is its
 * width; a column the view has gained since comes after the reader's, as the
 * view sets it. A width stays within its column's `min` and `max`.
 *
 * ```ts
 * const opened = resolveState(view, v.parse(ViewState, stored));
 * ```
 */
export function resolveState<L extends Layouts<L> = AnyLayouts>(
  view: View<L>,
  state: ViewState = {},
): ResolvedState {
  const columns = columnsIn(view);
  const byKey = new Map(columns.map((column) => [column.fixed.key, column]));
  const placed = (state.columns ?? []).flatMap((entry) => {
    const column = byKey.get(entry.key);
    return column ? [{ key: entry.key, hidden: entry.hidden ?? column.fixed.hidden ?? false }] : [];
  });
  const named = new Set(placed.map((entry) => entry.key));
  const unplaced = columns
    .filter((column) => !named.has(column.fixed.key))
    .map((column) => ({ key: column.fixed.key, hidden: column.fixed.hidden ?? false }));
  const widths = Object.entries(state.widths ?? {}).flatMap(([key, width]) => {
    const column = byKey.get(key);
    if (!column) {
      return [];
    }
    const { min = 0, max = Infinity } = column.fixed.width ?? {};
    return [[key, Math.min(max, Math.max(min, width))] as const];
  });
  return {
    columns: [...placed, ...unplaced],
    widths: Object.fromEntries(widths),
    sort: state.sort ?? view.sort ?? [],
    ...(state.filters === undefined ? {} : { filters: state.filters }),
    collapsed: view.group ? (state.collapsed ?? []) : [],
  };
}

/**
 * A table view's columns as its reader left them: in their order, each one's
 * `hidden` the reader's, or the view's when the reader didn't say.
 */
export function columnsOf<L extends Layouts<L> = AnyLayouts>(
  view: TableView<L>,
  state?: ViewState,
): Column<L>[] {
  const byKey = new Map(view.columns.map((column) => [column.fixed.key, column]));
  return resolveState(view, state).columns.flatMap(({ key, hidden }) => {
    const column = byKey.get(key);
    return column ? [{ ...column, fixed: { ...column.fixed, hidden } }] : [];
  });
}
