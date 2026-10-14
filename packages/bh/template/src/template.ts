import type { Filter } from '@bh/resource';
import type { BaseLayouts } from './layouts';
import type { Part } from './part';

// A template: what a record shows, as JSON. A table column's cell, a list
// item, a tile and a card's body are all templates, drawn by the same code.
// It is a tree: a layout node names a registered layout and holds nodes, and a
// part is a leaf. It holds no code, so it is stored as it is, in a view.

/**
 * A template, or any node in one: a layout holding nodes, or a part. Its root
 * is a node like any other, so a cell showing one field is one part.
 *
 * `L` names the layouts it may use, with their options: bh's three
 * (BaseLayouts) unless an app adds its own.
 */
export type TemplateNode<L extends Layouts<L> = BaseLayouts> = LayoutNode<L> | Part;

/**
 * Layouts by name, each with the options it takes: BaseLayouts, or an
 * interface an app extends it with.
 */
export type Layouts<L> = Record<keyof L, object>;

/**
 * A layout node: the nodes it holds, drawn by the layout it names. Layouts
 * nest in each other as deep as a template needs.
 */
export type LayoutNode<L extends Layouts<L> = BaseLayouts> = {
  [K in keyof L & string]: LayoutNodeBase<K, L> & OptionsOf<L[K]>;
}[keyof L & string];

interface LayoutNodeBase<K extends string, L extends Layouts<L>> {
  /** A registered layout's name: 'flex', 'grid', 'repeat', or an app's own. */
  layout: K;
  /** What it lays out, in order: parts, and layouts holding more. */
  nodes: TemplateNode<L>[];
  /**
   * A filter on the record (@bh/resource's Filter): the node shows, with
   * everything in it, only while it holds. Without one, it always shows.
   */
  when?: Filter;
}

/** A layout's options: required when one of them is, as grid's columns. */
type OptionsOf<O> =
  Partial<O> extends O
    ? {
        /** Its layout's options; each one's default when absent. */
        options?: O;
      }
    : {
        /** Its layout's options. */
        options: O;
      };
