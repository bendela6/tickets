import type { Filter, OperatorRegistry, Scalar } from '@bh/resource';
import type { LayoutNode } from '../types/layout-node';
import type { InputRegistry, LayoutComponentRegistry } from '../types/registry';
import { collectFields } from '../runtime/collect-fields';
import {
  addOnce,
  entriesOf,
  type FilterField,
  isEmptyValue,
  isOperand,
  operatorsOr,
  pathOf,
  takesNoOperand,
  type FilterOptions,
} from './conditions';

/**
 * What a filter form hands out: the query's own `search` and `filter`
 * (`Query` in `@bh/resource`), so it passes straight into a query.
 */
export interface FilterQuery {
  /** What the field named `search` holds; left out when it's empty. */
  search?: string;
  /** Every field's conditions, in one `all`: a filter form's are joined by all only. */
  filter: Filter;
}

/** A form's nodes, of any registry: what the fold and its inverse walk. */
export type AnyNodes = readonly LayoutNode<InputRegistry, LayoutComponentRegistry>[];

/** The fields of a tree that hold a part of the filter, in the order they're drawn. */
export function filterFields(nodes: AnyNodes): FilterField[] {
  const fields = collectFields(nodes as LayoutNode<InputRegistry, LayoutComponentRegistry>[]);
  return [...fields.values()].filter((field): field is FilterField => field.filter !== undefined);
}

/**
 * The operand a `{ op }` field's value writes, or null for no condition: the
 * value through `map` (each of a list's values, as a string key), else the
 * value itself while it isn't empty.
 */
export function operandOf(
  map: Record<string, Scalar | Scalar[] | null> | undefined,
  value: unknown,
): Scalar | Scalar[] | null {
  if (map) {
    if (Array.isArray(value)) {
      const out: Scalar[] = [];
      for (const each of value as unknown[]) {
        const key = String(each);
        const mapped = Object.hasOwn(map, key) ? map[key] : each;
        if (mapped !== null && mapped !== undefined) {
          out.push(...((Array.isArray(mapped) ? mapped : [mapped]) as Scalar[]));
        }
      }
      return out.length > 0 ? out : null;
    }
    const key = String(value);
    if (Object.hasOwn(map, key)) {
      return map[key] ?? null;
    }
  }
  if (isEmptyValue(value)) {
    return null;
  }
  return isOperand(value) ? value : null;
}

/** The presets a presets field's value names: a list's values, or one value. */
export function presetNames(value: unknown): Set<string> {
  if (Array.isArray(value)) {
    return new Set(value.filter((each): each is string => typeof each === 'string'));
  }
  return typeof value === 'string' && value !== '' ? new Set([value]) : new Set();
}

/** What one field's value writes into the filter. */
function write(
  field: FilterField,
  value: unknown,
  operators: OperatorRegistry,
  out: Filter[],
): void {
  const filter = field.filter;
  if ('op' in filter) {
    const operand = operandOf(filter.map, value);
    if (operand === null) {
      return;
    }
    const path = pathOf(field);
    addOnce(
      out,
      takesNoOperand(filter.op, operators)
        ? { field: path, op: filter.op }
        : { field: path, op: filter.op, value: operand },
    );
    return;
  }
  if ('range' in filter) {
    const halves = Array.isArray(value) ? (value as unknown[]) : [];
    for (const [index, op] of filter.range.entries()) {
      const half = halves[index];
      if (!isEmptyValue(half) && isOperand(half)) {
        addOnce(out, { field: pathOf(field), op, value: half });
      }
    }
    return;
  }
  if ('presets' in filter) {
    const on = presetNames(value);
    for (const preset of filter.presets) {
      if (on.has(preset.value)) {
        for (const entry of entriesOf(preset.filter)) {
          addOnce(out, entry);
        }
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value as Filter[]) {
      if (typeof entry === 'object' && entry !== null) {
        addOnce(out, entry);
      }
    }
  }
}

/**
 * Folds a filter form's field values into the query's `{ search, filter }`.
 * The field named `search` becomes `search`, left out when it's `''`. Each
 * field with a `filter` writes into one `{ all: [...] }`:
 *
 * - `{ op }`: `{ field, op, value }`, unless the value is its kind's empty one
 *   (`''`, `null`, `[]`, `false`) or `map` turns it to `null`. An operator
 *   that takes no operand (`empty`, `notEmpty`, `isMe`) writes `{ field, op }`
 *   while the value isn't empty.
 * - `{ range }`: a condition for each half that's set.
 * - `{ presets }`: the filter of each preset that's on, an `all` spread into
 *   the list.
 * - `{ rules }`: each entry as it is.
 *
 * The same condition is written once. Only the fields `values` holds write,
 * so a field `when` hides writes nothing when it's given the visible values,
 * as `onCommit` and `onSubmit` hand them. `options.operators` says which
 * take no operand: bh's fifteen when it's left out.
 */
export function foldFilter(
  nodes: AnyNodes,
  values: Record<string, unknown>,
  options: FilterOptions = {},
): FilterQuery {
  const registry = operatorsOr(options.operators);
  const all: Filter[] = [];
  for (const field of filterFields(nodes)) {
    if (field.name !== 'search' && Object.hasOwn(values, field.name)) {
      write(field, values[field.name], registry, all);
    }
  }
  const search = values.search;
  return typeof search === 'string' && search !== ''
    ? { search, filter: { all } }
    : { filter: { all } };
}
