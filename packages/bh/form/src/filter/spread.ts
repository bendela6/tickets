import type { Condition, Filter, Scalar } from '@bh/resource';
import type { WhenClause } from '../types/when';
import { sameValues } from '../runtime/commits';
import {
  entriesOf,
  type FilterField,
  type FilterOptions,
  isCondition,
  pathOf,
  sameFilter,
} from './conditions';
import { type AnyNodes, filterFields } from './fold';

/** What a filter form's fields hold for a value, and what none of them does. */
export interface SpreadFilter {
  /** Each field's value, by name: what it holds of the filter, else its empty value. */
  values: Record<string, unknown>;
  /** The entries no field holds, with no `rules` field to take them: folded back unchanged. */
  rest: Filter[];
}

/** A map's key back as the value an input holds: `'true'` and `'false'` as booleans. */
function fromKey(key: string): unknown {
  if (key === 'true') {
    return true;
  }
  return key === 'false' ? false : key;
}

/** The key of a map whose operand is this one, if any. */
function keyFor(
  map: Record<string, Scalar | Scalar[] | null>,
  operand: unknown,
): string | undefined {
  return Object.keys(map).find((key) => map[key] !== null && sameValues(map[key], operand));
}

/**
 * The value an `{ op }` field holds for a condition it matches, or undefined
 * when it can't hold it: a map with no key for its operand.
 */
function opValue(field: FilterField, condition: Condition): unknown {
  const filter = field.filter as Extract<FilterField['filter'], { op: string }>;
  if (condition.value === undefined) {
    // An operator with no operand: on, as a checkbox or a switch holds it.
    return true;
  }
  const map = filter.map;
  if (!map) {
    return condition.value;
  }
  if (Array.isArray(condition.value)) {
    const whole = keyFor(map, condition.value);
    if (whole !== undefined) {
      return [fromKey(whole)];
    }
    const keys = condition.value.map((each) => keyFor(map, each));
    return keys.every((key) => key !== undefined) ? keys.map((key) => fromKey(key)) : undefined;
  }
  const key = keyFor(map, condition.value);
  return key === undefined ? undefined : fromKey(key);
}

/** Whether every one of these entries is in the value's. */
function holdsAll(entries: Filter[], all: Filter[]): boolean {
  return entries.every((entry) => all.some((each) => sameFilter(each, entry)));
}

/** The field and value a `when` of one field's value sets: `{ field: 'show', eq: 'by-person' }`. */
function setBy(when: WhenClause | undefined): { field: string; value: unknown } | undefined {
  return when && 'eq' in when ? { field: when.field, value: when.eq } : undefined;
}

/**
 * Puts a `{ search, filter }` value back onto a filter form's fields: each
 * condition of the value's `all` shows in every field it matches.
 *
 * - An `{ op }` field with the same field and operator takes its value,
 *   through `map` reversed (a key `'true'` or `'false'` comes back a
 *   boolean); one holding a condition whose operator takes no operand is on
 *   (`true`). Each takes the first condition it matches.
 * - A `{ range }` field takes either half.
 * - A preset is on when every condition of its filter is in the value. A
 *   field holding one preset, as a segmented does, takes the one with the
 *   most conditions, the first of them on a tie, a preset of none (`{ all:
 *   [] }`) only when no other is on.
 * - A condition nothing takes, and any `any` or `not` group, goes to the
 *   `{ rules }` field; with no rules field, to `rest`, which a filter form
 *   folds back unchanged. A value that isn't an `all` is one entry of `rest`.
 *
 * A field that took a condition and is shown by a `when` of another field's
 * value (`{ field: 'show', eq: 'by-person' }`) sets that field, unless it
 * took a condition of its own, so the condition stays in view. The field
 * named `search` takes the value's `search`. A field the value sets nothing
 * of holds its map's key for `null` (no condition), else its empty value
 * (`options.emptyOf`).
 */
export function spreadFilter(
  nodes: AnyNodes,
  value: { search?: string; filter?: Filter },
  options: FilterOptions = {},
): SpreadFilter {
  const fields = filterFields(nodes);
  const filter = value.filter ?? { all: [] };
  const all = 'all' in filter ? filter.all : [];
  const rest: Filter[] = 'all' in filter ? [] : [filter];
  const values: Record<string, unknown> = {};
  const taken = new Set<number>();
  // The fields that took a condition of the value.
  const took = new Set<string>();

  for (const field of fields) {
    const own = field.filter;
    if ('op' in own) {
      const index = all.findIndex((entry) => {
        return isCondition(entry) && entry.field === pathOf(field) && entry.op === own.op;
      });
      const held = index === -1 ? undefined : opValue(field, all[index] as Condition);
      if (held !== undefined) {
        values[field.name] = held;
        taken.add(index);
        took.add(field.name);
      }
    } else if ('range' in own) {
      const halves = own.range.map((op) => {
        return all.findIndex((entry) => {
          return isCondition(entry) && entry.field === pathOf(field) && entry.op === op;
        });
      });
      if (halves.some((index) => index !== -1)) {
        values[field.name] = halves.map((index) => {
          return index === -1 ? null : ((all[index] as Condition).value ?? null);
        });
        halves.filter((index) => index !== -1).forEach((index) => taken.add(index));
        took.add(field.name);
      }
    } else if ('presets' in own) {
      const one = options.emptyOf !== undefined && !Array.isArray(options.emptyOf(field));
      const on = own.presets.filter((preset) => holdsAll(entriesOf(preset.filter), all));
      // One preset: the one with the most conditions, the first on a tie.
      const best = [...on].sort((a, b) => {
        return entriesOf(b.filter).length - entriesOf(a.filter).length;
      })[0];
      const chosen = (one ? (best ? [best] : []) : on).filter((preset) => {
        return entriesOf(preset.filter).length > 0;
      });
      for (const preset of chosen) {
        for (const entry of entriesOf(preset.filter)) {
          all.forEach((each, index) => sameFilter(each, entry) && taken.add(index));
        }
      }
      values[field.name] = one ? (best?.value ?? '') : chosen.map((preset) => preset.value);
      if (chosen.length > 0) {
        took.add(field.name);
      }
    }
  }

  // What no field took goes to the first rules field, else to rest.
  const left = all.filter((_, index) => !taken.has(index));
  const rules = fields.find((field) => 'rules' in field.filter);
  if (rules) {
    values[rules.name] = left;
    if (left.length > 0) {
      took.add(rules.name);
    }
  } else {
    rest.push(...left);
  }

  for (const field of fields) {
    if (!(field.name in values)) {
      const own = field.filter;
      const off =
        'op' in own && own.map
          ? Object.keys(own.map).find((key) => own.map?.[key] === null)
          : undefined;
      if (off !== undefined) {
        values[field.name] = fromKey(off);
      } else if (options.emptyOf) {
        values[field.name] = options.emptyOf(field);
      }
    }
  }

  // A field `when` shows by another's value sets it, so what it took is seen.
  for (const field of fields) {
    const shows = setBy(field.when);
    if (shows && took.has(field.name) && !took.has(shows.field)) {
      values[shows.field] = shows.value;
    }
  }

  if (nodesHoldSearch(nodes)) {
    values.search = value.search ?? '';
  }
  return { values, rest };
}

/** Whether the form has a field named `search`. */
function nodesHoldSearch(nodes: AnyNodes): boolean {
  const walk = (list: AnyNodes): boolean => {
    return list.some((node) => {
      if (node.kind === 'field') {
        return (node as { name: string }).name === 'search';
      }
      return 'children' in node && walk(node.children);
    });
  };
  return walk(nodes);
}
