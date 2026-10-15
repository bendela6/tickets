import type { FieldPath, Filter, Operator, Scalar } from '@bh/resource';

/**
 * One named filter a field turns on or off: "Mine", "Updated this week". Its
 * `value` is what the field holds while it's on; its `filter` is what it adds
 * to the query's, an `all` of conditions or one condition.
 */
export interface Preset {
  /** What the field holds for it: `'mine'`. */
  value: string;
  /** How it reads: `'Mine'`. */
  label: string;
  /** What it adds while it's on: `{ field: 'assignee', op: 'isMe' }`. */
  filter: Filter;
}

/**
 * Which part of the query's filter a field holds: plain data, so a stored
 * `FormConfig` keeps it as it is. A filter form folds every field's value into
 * one `{ all: [...] }` by it, and puts a filter back onto its fields.
 *
 * - `{ op }`: the field's value is the operand of `field op value`. `field` is
 *   the field's own name when absent. `map` turns an input's value, as a
 *   string key (`'true'`, `'24h'`), into the operand, and `null` into no
 *   condition.
 * - `{ range }`: a `[from, to]` value: `field gte from` and `field lte to`,
 *   each half only when it's set.
 * - `{ presets }`: the value names presets, each one on or off.
 * - `{ rules: true }`: the value is a list of filters, each kept as it is.
 */
export type FieldFilter =
  | {
      /** The operator its condition names: `'equals'`, `'in'`, `'inLast'`. */
      op: Operator;
      /** The field or path it filters: the field's own name when absent. */
      field?: FieldPath;
      /** An input's value, as a string key, to the operand; `null` is no condition. */
      map?: Record<string, Scalar | Scalar[] | null>;
    }
  | {
      /** The operators of the two halves: `['gte', 'lte']`. */
      range: [Operator, Operator];
      /** The field or path it filters: the field's own name when absent. */
      field?: FieldPath;
    }
  | {
      /** The presets the value names, in the order they're drawn. */
      presets: Preset[];
    }
  | {
      /** The value is a list of filters, each kept as it is. */
      rules: true;
    };
