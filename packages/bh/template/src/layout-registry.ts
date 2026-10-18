import * as v from 'valibot';
import type { FieldPath, Row } from '@bh/resource';
import { functionSchema, optionsSchema } from './registry';

/** What a layout lays out. `O` is its options; `N` a drawn node. */
export interface LayoutProps<O, N> {
  /** Its options, as the node gives them. */
  options: O;
  /** Its drawn nodes, in order. Empty parts are left out. */
  items: readonly N[];
  /** Entries past `max`, for a repeating layout. Else 0. */
  more: number;
}

/** A layout without its component. `O` is its options. */
export interface LayoutSpec<O> {
  /** Its options' schema. */
  options: v.GenericSchema<unknown, O>;
  /** Repeats its nodes once per entry of a list field. */
  repeats?: (options: O) => { field: FieldPath; max?: number };
}

/** A layout: its spec and its component, `C`. */
export interface LayoutEntry<C, O> extends LayoutSpec<O> {
  /** Lays out its items, given `LayoutProps<O>`. */
  Component: C;
}

/** What a layout registry checks of a layout, beside its component. */
export const layoutData = v.object({
  options: optionsSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repeats: v.optional(functionSchema<LayoutSpec<any>['repeats']>('its repeats')),
});

/** The record once per entry of a list field, up to `max`, and how many are past it. */
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
