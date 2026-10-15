import type { Filter } from '@bh/resource';
import { entriesOf, type FilterField, type FilterOptions, pathOf, sameFilter } from './conditions';
import { filterFields, type FilterQuery, foldFilter } from './fold';
import type { AnyNodes } from './fold';
import { spreadFilter } from './spread';

/** The counts one field asks for, with `counts: true` in its config. */
export type CountAsk =
  | {
      /** The field, by name. */
      name: string;
      /** A grouped count on its path (`countsBy`): the rows each option would show. */
      path: string;
      /** The value with the field's own condition left out. */
      query: FilterQuery;
    }
  | {
      /** The field, by name. */
      name: string;
      /** One count per preset (`countFor`): the value with the field's condition swapped for it. */
      presets: { value: string; query: FilterQuery }[];
    };

/** A filter's entries less these. */
function without(entries: readonly Filter[], drop: readonly Filter[]): Filter[] {
  return entries.filter((entry) => !drop.some((each) => sameFilter(each, entry)));
}

/** A query of these entries, with the value's search. */
function queryOf(search: string | undefined, all: Filter[]): FilterQuery {
  return search === undefined || search === '' ? { filter: { all } } : { search, filter: { all } };
}

/** The page's locked conditions first, then these. */
function withFirst(locked: readonly Filter[], entries: readonly Filter[]): Filter[] {
  return [...locked, ...without(entries, locked)];
}

/**
 * What each field with `counts: true` asks for, for a value. An option's
 * count is the rows picking it would show: the value with the field's own
 * condition left out, every other filter as it is, so picking a second
 * status doesn't zero the rest. A preset's is the value with the field's
 * conditions swapped for the preset's. The page's locked conditions, which
 * no field holds, come first in every query.
 */
export function countAsks(
  nodes: AnyNodes,
  value: { search?: string; filter?: Filter },
  options: FilterOptions = {},
  locked: readonly Filter[] = [],
): CountAsk[] {
  const fields = filterFields(nodes).filter((field: FilterField) => {
    return (field.config as { counts?: unknown }).counts === true && !('rules' in field.filter);
  });
  if (fields.length === 0) {
    return [];
  }
  const { values } = spreadFilter(nodes, value, options);
  const entries = entriesOf(value.filter ?? { all: [] });
  return fields.map((field): CountAsk => {
    // What the field writes for what it holds of the value.
    const own = foldFilter([field], { [field.name]: values[field.name] }, options).filter;
    const others = without(entries, entriesOf(own));
    const filter = field.filter;
    if ('presets' in filter) {
      return {
        name: field.name,
        presets: filter.presets.map((preset) => {
          const all = [...others, ...without(entriesOf(preset.filter), others)];
          return { value: preset.value, query: queryOf(value.search, withFirst(locked, all)) };
        }),
      };
    }
    return {
      name: field.name,
      path: pathOf(field),
      query: queryOf(value.search, withFirst(locked, others)),
    };
  });
}
