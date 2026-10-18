import {
  baseOperators,
  type Condition,
  type Filter,
  type OperatorRegistry,
  type Scalar,
} from '@bh/resource';
import type { FieldFilter } from '../types/field-filter';
import type { FieldNode } from '../types/field-node';
import type { InputRegistry } from '../types/registry';
import { sameValues } from '../runtime/commits';

// What folding a form's values into the query's filter and spreading it back
// share: which values are empty, which operators take an operand, and when two
// filters are the same one.

/** What folding and spreading a filter take besides the nodes and the value. */
export interface FilterOptions {
  /** The operators, for which take no operand: bh's fifteen when it's left out. */
  operators?: OperatorRegistry;
  /**
   * A field's empty value: the registry's `defaultValue` for its type. It says
   * what a field holds when the filter sets nothing of it, and whether a
   * presets field holds a list or one preset. Left out, a field the filter
   * sets nothing of is left out too, and a presets field holds a list.
   */
  emptyOf?: (field: FieldNode<InputRegistry>) => unknown;
}

/** A field of a filter form: one with a `filter` key. */
export type FilterField = FieldNode<InputRegistry> & { filter: FieldFilter };

/** The operators given, else bh's fifteen, which a fold reads when it's given none. */
export function operatorsOr(operators: OperatorRegistry | undefined): OperatorRegistry {
  return operators ?? baseOperators;
}

/**
 * Whether an operator takes no operand, as `empty`, `notEmpty` and `isMe`
 * don't: its entry has no `operand`. One nothing registered is taken to take
 * one.
 */
export function takesNoOperand(op: string, operators: OperatorRegistry): boolean {
  const spec = operators.has(op) ? operators.get(op) : undefined;
  return spec !== undefined && spec.operand === undefined;
}

/**
 * Whether a field's value is its kind's empty one, which writes no
 * condition: `''`, `null`, `[]`, `false`, or none at all.
 */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Whether two filters are the same one: the same keys holding the same values. */
export function sameFilter(a: Filter, b: Filter): boolean {
  return sameValues(a, b);
}

/** Whether a filter is a condition, not a group. */
export function isCondition(filter: Filter): filter is Condition {
  return 'field' in filter;
}

/** A filter's entries as one `all` holds them: an `all`'s own, anything else as one. */
export function entriesOf(filter: Filter): Filter[] {
  return 'all' in filter ? filter.all : [filter];
}

/** Adds an entry unless the list holds the same one already. */
export function addOnce(list: Filter[], entry: Filter): void {
  if (!list.some((each) => sameFilter(each, entry))) {
    list.push(entry);
  }
}

/** The field or path a field's condition names: its `filter.field`, else its own name. */
export function pathOf(node: FilterField): string {
  const filter = node.filter;
  return ('field' in filter ? filter.field : undefined) ?? node.name;
}

/** Whether a value is one a condition may hold: a scalar, or a list of them. */
export function isOperand(value: unknown): value is Scalar | Scalar[] {
  const scalar = (each: unknown) => {
    return (
      typeof each === 'string' ||
      typeof each === 'boolean' ||
      (typeof each === 'number' && Number.isFinite(each))
    );
  };
  return scalar(value) || (Array.isArray(value) && value.every(scalar));
}
