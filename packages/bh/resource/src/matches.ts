import * as v from 'valibot';
import type { ResourceMeta } from './meta';
import type { Filter } from './query';
import type { Registry } from './registry';
import { optionSettings } from './schemas';
import type { Json, Row, Scalar } from './values';

// Whether a row passes a filter, in plain JavaScript, by each operator's
// `matches`: a client keeps or drops a row it just wrote from a list it holds
// (TK-12.3), a template shows a part while its `when` holds (TK-79.1), and the
// adapters' tests compare their SQL with it (TK-12.4). And whether a query's
// search keeps it, by the same rule as the server.

/** What an operator's `matches` takes: one value, a list of them, or null. */
type Matched = Scalar | Scalar[] | null;

/** Whether `value` is an object of keys, not a list or null. */
function isObject(value: Json | undefined): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The value a path reads from a row, as an operator's `matches` takes it:
 *
 * - 'status': the field's value; null when the row doesn't hold it.
 * - 'status.kind': on an option field, the attribute of the option the row
 *   holds (null when it carries none); a list of them on a many field, those
 *   without one left out.
 * - 'services.name': on an object value, its key, one level only: a
 *   template's `repeat` shows one entry of a list field at a time, and a
 *   `when` inside it reads into that entry (TK-79.1).
 */
export function valueAt(path: string, row: Row, meta: ResourceMeta): Matched {
  const [key = '', name] = path.split('.');
  const value = row[key] ?? null;
  if (name === undefined) {
    return value as Matched;
  }
  if (isObject(value)) {
    return (value[name] ?? null) as Matched;
  }
  const field = meta.fields.find((each) => each.key === key);
  const settings = v.safeParse(optionSettings, field?.type.settings);
  const options = settings.success ? settings.output.options : [];
  const attributeOf = (held: Json) => {
    return options.find((option) => option.value === held)?.attributes?.[name] ?? null;
  };
  if (Array.isArray(value)) {
    return value.map(attributeOf).filter((each) => each !== null);
  }
  return attributeOf(value);
}

/**
 * Whether `row` passes `filter`, by the registered operators' `matches`, the
 * same rules as each adapter's SQL: `all` when every one holds ({all: []}
 * keeps every row), `any` when one does ({any: []} keeps none), `not` when
 * it doesn't. `meta` reads a path through an option's attributes; `viewer`
 * is the signed-in user's id, for `isMe`, undefined when no one is signed in.
 * Throws on an operator nothing registered: a filter queryOf has checked
 * names none.
 */
export function matchesFilter(
  filter: Filter,
  row: Row,
  meta: ResourceMeta,
  registry: Registry,
  viewer?: Scalar,
): boolean {
  if ('all' in filter) {
    return filter.all.every((each) => matchesFilter(each, row, meta, registry, viewer));
  }
  if ('any' in filter) {
    return filter.any.some((each) => matchesFilter(each, row, meta, registry, viewer));
  }
  if ('not' in filter) {
    return !matchesFilter(filter.not, row, meta, registry, viewer);
  }
  const operator = registry.operators.find((spec) => spec.name === filter.op);
  if (!operator) {
    throw new Error(`No operator is registered as "${filter.op}".`);
  }
  return operator.matches(valueAt(filter.field, row, meta), filter.value, viewer);
}

/** A value's entries: a list's, one value as a list of one, none as []. */
function entriesOf(value: Json | undefined): Json[] {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Whether a query's `search` keeps `row`: a field whose `query.search` is
 * true holds the term, case ignored, matched whole, as one piece of text. A
 * kind's `searchText` says what is read (a rich text's words, never its
 * JSON); the value as text when it says nothing. On a many field, one of its
 * values holds it.
 */
export function matchesSearch(
  term: string,
  row: Row,
  meta: ResourceMeta,
  registry: Registry,
): boolean {
  const looked = term.toLowerCase();
  return meta.fields.some((field) => {
    if (!field.query.search) {
      return false;
    }
    const kind = registry.kinds.find((spec) => spec.name === field.type.kind);
    return entriesOf(row[field.key]).some((each) => {
      if (typeof each === 'object' || each === null) {
        return false;
      }
      const text = kind?.searchText ? kind.searchText(each) : String(each);
      return text.toLowerCase().includes(looked);
    });
  });
}
