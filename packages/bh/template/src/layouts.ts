import type { FieldPath } from '@bh/resource';

// bh's three layouts, by the options each takes: `flex`, `grid` and `repeat`.
// A template's layout node names one and gives its options (LayoutNode); the
// layout registry holds each one's options' schema and how it lays out its
// nodes (baseLayoutSpecs), @bh/ui each one's component, and an app registers
// its own beside them, an overlay among them.

/**
 * Space between a layout's nodes, in steps of 4 pixels: 0, 4, 8, 12, 16, 24
 * or 32. The steps @bh/ui's Row and Stack take.
 */
export type Gap = 0 | 1 | 2 | 3 | 4 | 6 | 8;

/**
 * Nodes side by side or one under another: a row, two sides, a stack. Every
 * option has a default, so `{layout: 'flex', nodes}` is a row.
 */
export interface FlexOptions {
  /** A row, or a column one under another; row when absent. */
  direction?: 'row' | 'column';
  /**
   * How the nodes spread along it: packed at its start, its center or its end,
   * or `between`, the first at the start and the last at the end, as two sides
   * are. start when absent.
   */
  justify?: 'start' | 'center' | 'end' | 'between';
  /**
   * Where the nodes sit across it. `baseline` lines a row's texts up on their
   * baselines, a label beside a number. center in a row and stretch in a
   * column when absent, as @bh/ui's Row and Stack have it.
   */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  /** The space between its nodes; none when absent. */
  gap?: Gap;
  /** Nodes that don't fit go on to the next line; they don't when absent. */
  wrap?: boolean;
}

/** Nodes in columns, row after row, as a tile's figures or a card's facts. */
export interface GridOptions {
  /**
   * Its columns: fixed, a count of equal ones (`2`); or by width, as many as
   * fit, each at least `min` pixels wide (`{min: 160}`), so a wide host has
   * more of them than a narrow one.
   */
  columns: number | { min: number };
  /** The space between its rows and between its columns; none when absent. */
  gap?: Gap;
  /** Where each node sits in its cell, across and down; stretch when absent. */
  align?: 'start' | 'center' | 'end' | 'stretch';
}

/**
 * One item per entry of a list field: a ticket's labels or assignees, a
 * stack's services. Its nodes are the item, drawn once for each entry, laid
 * out as `flex` lays out nodes (a row when nothing says otherwise); several
 * nodes follow one another in each item, so an item laid out otherwise is one
 * flex or grid node.
 *
 * In its nodes the record is the record, but for the field, which holds that
 * one entry: a part showing the field shows the entry, as a field holding one
 * value of its kind, and a node's `when` tests the entry. An entry that is an
 * object (a json list's) is reached a level down, by the field's key, a dot and
 * one of its keys ('services.name'), as a path reaches an option's attributes.
 */
export interface RepeatOptions extends FlexOptions {
  /** The list field: a many field (labels), or a json one holding a list. */
  field: FieldPath;
  /**
   * The most entries drawn; past it, the rest are counted, "+3". All of them
   * when absent.
   */
  max?: number;
}

/**
 * The layouts a template may name, each by its name with the options it
 * takes: bh's three. An app that registers its own (TK-79.10) types its
 * templates with an interface extending this one:
 *
 * ```ts
 * interface AppLayouts extends BaseLayouts {
 *   overlay: { anchor: 'top-end' | 'bottom-end' };
 * }
 * const tile: TemplateNode<AppLayouts> = { layout: 'overlay', options: { anchor: 'top-end' }, nodes };
 * ```
 */
export interface BaseLayouts {
  flex: FlexOptions;
  grid: GridOptions;
  repeat: RepeatOptions;
}
