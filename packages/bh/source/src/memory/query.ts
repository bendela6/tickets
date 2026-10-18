import {
  matchesFilter,
  type Json,
  type Query,
  type QueryResult,
  type Registry,
  type ResourceMeta,
  type Row,
} from '@bh/resource';
import { afterOf, cursorOf } from '../serve/cursor';
import type { Context } from '../types/context';
import { countGroups, groupsOf } from './groups';
import { rowOrder } from './order';

// A query served where bh holds every row itself (a source that answers
// them at once), by the contract's rules and the same functions a client and
// the adapters' tests use: matchesFilter for the filter, each kind's order
// for the sort, its search text for a search.

/** A value's entries: a list's, one value as a list of one, none as []. */
function entriesOf(value: Json | undefined): Json[] {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** Whether a row holds the term in a field a search looks in, case ignored. */
function holdsTerm(row: Row, term: string, meta: ResourceMeta, registry: Registry): boolean {
  const looked = term.toLowerCase();
  return meta.fields.some((field) => {
    if (!field.query.search) {
      return false;
    }
    const kind = registry.kinds.has(field.type.kind)
      ? registry.kinds.get(field.type.kind)
      : undefined;
    return entriesOf(row[field.key]).some((each) => {
      if (typeof each === 'object' || each === null) {
        return false;
      }
      const text = kind?.searchText ? kind.searchText(each) : String(each);
      return text.toLowerCase().includes(looked);
    });
  });
}

/** What a row's place in the order is kept by: its sort keys' fields and its id. */
function pivotOf(row: Row, query: Query, meta: ResourceMeta): Row {
  const keys = (query.sort ?? meta.sort).map(({ field }) => field.split('.')[0] ?? field);
  return Object.fromEntries([...keys, meta.roles.idField].map((key) => [key, row[key] ?? null]));
}

/**
 * A query served over every row: filtered by matchesFilter, searched by
 * each kind's search text, grouped, or sorted by each kind's order and
 * paged, numbered or after our cursor, which holds the last row's place.
 */
export function queryInMemory(
  rows: readonly Row[],
  query: Query,
  meta: ResourceMeta,
  registry: Registry,
  ctx: Context,
): QueryResult {
  const { filter, search, group } = query;
  let kept = filter
    ? rows.filter((row) => matchesFilter(filter, row, meta, registry, ctx.viewer))
    : [...rows];
  if (search !== undefined) {
    kept = kept.filter((row) => holdsTerm(row, search, meta, registry));
  }
  if (group) {
    const groups = groupsOf(countGroups(kept, group, meta), group, meta, registry);
    return { rows: [], groups, page: { next: null, more: false, total: kept.length } };
  }
  const order = rowOrder(query.sort ?? meta.sort, meta, registry);
  const sorted = kept.sort(order);
  const take = query.page?.take ?? Math.min(100, meta.serves.page.max);
  let start = query.page?.skip ?? 0;
  if (query.page?.cursor !== undefined) {
    const after = afterOf(query.page.cursor, query, meta) as Row;
    const at = sorted.findIndex((row) => order(row, after) > 0);
    start = at === -1 ? sorted.length : at;
  }
  const page = sorted.slice(start, start + take);
  const more = start + take < sorted.length;
  const last = page.at(-1);
  const next = more && last ? cursorOf(pivotOf(last, query, meta), query, meta) : null;
  return { rows: page, page: { next, more, total: sorted.length } };
}
