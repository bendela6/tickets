import * as v from 'valibot';
import type { FieldPath, Row } from '@bh/resource';
import type { BaseLayouts } from './layouts';

// The layout registry, the half of it that needs no React: each layout's
// options' schema and how it lays out the nodes it holds, and what a layout
// is given. A server checks a template's layout nodes against it; @bh/ui puts
// a component beside each of bh's three (`baseTemplateLayouts`), and an app
// spreads those and adds its own, an overlay among them, as a form's layouts
// are. One set serves every host.

/**
 * What a layout is given to lay out. `O` is its options, as its schema gives
 * them; `N` a node drawn, React's in @bh/ui.
 */
export interface LayoutProps<O, N> {
  /** Its options, as the node gives them; each one's default is the layout's to apply. */
  options: O;
  /**
   * What it lays out, in order: its nodes, drawn against the record, leaving
   * out those with nothing to show (a `when` that doesn't hold, an empty part
   * without an `empty` text). For a layout that repeats, each item is one
   * entry's nodes, drawn against the record with the field holding that entry.
   */
  items: readonly N[];
  /**
   * For a layout that repeats: how many entries are past its `max`, which it
   * counts ("+3") rather than draws. 0 for any other.
   */
  more: number;
}

/**
 * What the layout registry knows of a layout besides its component: its
 * options' schema, and how it lays out the nodes it holds. `O` is its
 * options.
 */
export interface LayoutSpec<O> {
  /** Its options' valibot schema: what a node naming it may give it, as `options`. */
  options: v.GenericSchema<unknown, O>;
  /**
   * How it lays out the nodes it holds. Without it, they are drawn once,
   * against the record, each an item: as flex and grid lay them out. With it,
   * they repeat: from its options, the list field and the most entries it
   * draws. They are drawn once per entry (entriesOf), with the field holding
   * that one entry, each entry's nodes one item, and the entries past `max`
   * are counted in `more`: as repeat lays them out.
   */
  repeats?: (options: O) => { field: FieldPath; max?: number };
}

/** A layout: its spec and the component that lays out its items, `C`: React's in @bh/ui. */
export interface LayoutEntry<C, O> extends LayoutSpec<O> {
  /** Lays out the items, given LayoutProps<O>. */
  Component: C;
}

const count = v.pipe(v.number(), v.integer(), v.minValue(1));

const gap = v.picklist([0, 1, 2, 3, 4, 6, 8]);

const flexEntries = {
  direction: v.optional(v.picklist(['row', 'column'])),
  justify: v.optional(v.picklist(['start', 'center', 'end', 'between'])),
  align: v.optional(v.picklist(['start', 'center', 'end', 'stretch', 'baseline'])),
  gap: v.optional(gap),
  wrap: v.optional(v.boolean()),
};

const flexOptions = v.strictObject(flexEntries);

const gridOptions = v.strictObject({
  columns: v.union([count, v.strictObject({ min: count })]),
  gap: v.optional(gap),
  align: v.optional(v.picklist(['start', 'center', 'end', 'stretch'])),
});

const repeatOptions = v.strictObject({
  ...flexEntries,
  field: v.pipe(v.string(), v.nonEmpty()),
  max: v.optional(count),
});

/**
 * bh's three layouts' specs: flex and grid draw their nodes once, and repeat
 * once per entry of its list field. Each schema gives its layout's options
 * (BaseLayouts). @bh/ui puts each one's component beside it.
 */
export const baseLayoutSpecs: {
  readonly [K in keyof BaseLayouts]: LayoutSpec<BaseLayouts[K]>;
} = Object.freeze({
  flex: { options: flexOptions },
  grid: { options: gridOptions },
  repeat: {
    options: repeatOptions,
    repeats: ({ field, max }: BaseLayouts['repeat']) => {
      return max === undefined ? { field } : { field, max };
    },
  },
});

/**
 * The records a repeating layout draws its nodes against: the record, once
 * per entry of its list field, with the field holding that one entry, up to
 * `max`; and how many entries are past it. A field holding one value that
 * isn't a list is one entry, and a field holding nothing, or absent, none.
 */
export function entriesOf(
  record: Row,
  field: FieldPath,
  max?: number,
): { records: Row[]; more: number } {
  const value = Object.hasOwn(record, field) ? record[field] : undefined;
  const entries = value == null ? [] : Array.isArray(value) ? value : [value];
  const drawn = max === undefined ? entries : entries.slice(0, max);
  return {
    records: drawn.map((entry) => {
      return { ...record, [field]: entry };
    }),
    more: entries.length - drawn.length,
  };
}
