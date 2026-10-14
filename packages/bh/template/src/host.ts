import type * as v from 'valibot';
import type { BaseLayouts } from './layouts';
import type { Layouts, TemplateNode } from './template';

// A host: what draws a record with a template. A table column's cell, a list
// item, a tile and a card's body are templates; each host keeps a few fixed
// parts of its own, set as plain values (a card's icon and title, a column's
// header and width), and the template is the rest. A column, a list item, a
// tile and a card each define theirs (TK-16.2, TK-19.1, TK-19.2, TK-76) by
// this contract.

/**
 * A kind of host, as it describes itself: which of its parts are fixed, set
 * as plain values, and where its template goes among them. `F` is its fixed
 * parts.
 *
 * ```ts
 * const card = defineHost({
 *   fixed: v.strictObject({ icon: v.optional(v.string()), title: v.string() }),
 *   order: ['icon', 'title', 'template'],
 * });
 * ```
 */
export interface HostSpec<F> {
  /**
   * Its fixed parts' valibot schema: plain JSON values (an icon's name, a
   * title, a width, an action's name), never a template's nodes. What a host
   * of its kind holds as `fixed`.
   */
  fixed: v.GenericSchema<unknown, F>;
  /**
   * The parts it draws, in the order it draws them, with 'template' where its
   * template goes: a card's icon, its title, then its body,
   * ['icon', 'title', 'template']. A fixed part that is a setting rather than
   * something drawn (a column's width, its sort) is none of them.
   */
  order: readonly (Extract<keyof F, string> | 'template')[];
}

/**
 * A host as a view stores it: its fixed parts, and the template it draws the
 * rest of a record with. A card:
 * `{ fixed: { icon: 'server', title: 'Hosts' }, template: { field: 'name' } }`.
 */
export interface Host<F, L extends Layouts<L> = BaseLayouts> {
  /** Its fixed parts, plain values its kind's schema checks (HostSpec.fixed). */
  fixed: F;
  /** What it draws from the record, where its kind's `order` puts it. */
  template: TemplateNode<L>;
}

/**
 * A kind of host, checked: its `order` names 'template' once, and no part
 * twice. Throws, saying which, when it doesn't; its type names only its fixed
 * parts.
 */
export function defineHost<F>(spec: HostSpec<F>): HostSpec<F> {
  const seen = new Set<string>();
  for (const part of spec.order) {
    if (seen.has(part)) {
      throw new Error(`A host's order names "${part}" twice.`);
    }
    seen.add(part);
  }
  if (!seen.has('template')) {
    throw new Error(`A host's order says where its template goes: it names no "template".`);
  }
  return spec;
}
