import { matchesFilter, matchesSearch, valueAt } from '../matches';
import type { ResourceMeta } from '../meta';
import { rowOrder, type TitleOf } from '../order';
import type { Query, QueryResult } from '../query';
import type { Registry } from '../registry';
import type { Id, Row, Scalar } from '../values';

// What a list a client holds does with a row it just wrote, without asking
// the server again: it keeps the row or drops it, by the query's filter
// (matchesFilter) and search (matchesSearch), and puts a kept one in its
// place by the query's order (rowOrder). A list is one query's pages, in
// order: a numbered page, or the pages a cursor brought, one after another.
// Where the client can't tell (a group's counts, an order it can't make
// here), these answer undefined and the caller asks the server again.

/** What placing a row in a query's answer needs beyond the rows. */
export interface HeldContext {
  /** The query the list answers. */
  query: Query;
  meta: ResourceMeta;
  /** bh's kinds and operators and the app's own, as the server runs with. */
  registry: Registry;
  /** The signed-in user's id, for `isMe`; undefined when no one is. */
  viewer?: Scalar;
  /** The titles a ref orders by; without it a list sorted by a ref can't place a row. */
  titleOf?: TitleOf;
}

/**
 * What the client knew of the row before it wrote it: the row as it last saw
 * it; null when there was none (a create); undefined when it doesn't know,
 * and then the row was in a list only if the list held it.
 */
export type Previous = Row | null | undefined;

/** Where the pages a list holds sit among every row the query keeps. */
export interface HeldEdges {
  /** Rows come before the first page held: a numbered page past the first, a page after a cursor. */
  before: boolean;
  /** Rows follow the last page held: its `page.more`. */
  after: boolean;
}

/** Whether the query keeps the row: its filter and its search both hold. */
export function keepsRow(row: Row, context: HeldContext): boolean {
  const { query, meta, registry, viewer } = context;
  return (
    (query.filter === undefined || matchesFilter(query.filter, row, meta, registry, viewer)) &&
    (query.search === undefined || matchesSearch(query.search, row, meta, registry))
  );
}

/** The row as the query's answer carries it: the fields it asked for and those its roles name. */
function asAsked(row: Row, query: Query, meta: ResourceMeta): Row {
  if (!query.fields) {
    return row;
  }
  const roles = Object.values(meta.roles).filter((key) => key !== undefined);
  const kept = new Set([...query.fields, ...roles]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => kept.has(key)));
}

/** The key a sort path reads from a row: 'status.kind' reads 'status'. */
const rootOf = (path: string) => path.split('.')[0] ?? path;

/**
 * The comparator the list's rows are in, or undefined when it can't be made
 * here: a key its kind doesn't order, a ref whose titles aren't all known,
 * or a key the held rows don't carry (a query's `fields` left it out).
 */
function orderOf(
  rows: readonly Row[],
  context: HeldContext,
): ((a: Row, b: Row) => number) | undefined {
  const { query, meta, registry, titleOf } = context;
  const sort = query.sort ?? meta.sort;
  if (query.fields) {
    const carried = new Set([...query.fields, ...Object.values(meta.roles)]);
    if (sort.some(({ field }) => !carried.has(rootOf(field)))) {
      return undefined;
    }
  }
  for (const { field: path } of sort) {
    const field = meta.fields.find((each) => each.key === path);
    const of = field?.type.kind === 'ref' ? field.type.settings?.['of'] : undefined;
    if (typeof of !== 'string' || field?.type.many === true) {
      continue;
    }
    const untitled = rows.some((row) => {
      const id = valueAt(path, row, meta);
      return id !== null && !Array.isArray(id) && titleOf?.(of, id as Id) === undefined;
    });
    if (untitled) {
      return undefined;
    }
  }
  return rowOrder(sort, meta, registry, titleOf ? { titleOf } : {});
}

/**
 * The pages after a row was written, its old copy taken out and the new one
 * in its place, or out when the query no longer keeps it; and how many more
 * rows the query keeps: 1 when the row entered, -1 when it left, 0 when
 * neither. Undefined when the client can't tell where the row goes.
 *
 * A kept row goes before the first held row it comes before. Past the last
 * held row it goes last only when no rows follow (`after`); before the first
 * held row, first only when none come before (`before`): otherwise it sits
 * on a page the client doesn't hold, and these pages lose it.
 */
export function placeRow(
  pages: readonly (readonly Row[])[],
  row: Row,
  previous: Previous,
  edges: HeldEdges,
  context: HeldContext,
): { pages: Row[][]; entered: -1 | 0 | 1 } | undefined {
  const { query, meta } = context;
  const id = meta.roles.idField;
  const same = (each: Row) => each[id] === row[id];
  const held = pages.some((page) => page.some(same));
  const without = pages.map((page) => page.filter((each) => !same(each)));
  const kept = keepsRow(row, context);
  const before = previous === undefined ? held : previous !== null && keepsRow(previous, context);
  const entered = (Number(kept) - Number(before)) as -1 | 0 | 1;
  if (!kept) {
    return { pages: without, entered };
  }
  const flat = without.flat();
  const order = orderOf([row, ...flat], context);
  if (!order) {
    return undefined;
  }
  const at = flat.findIndex((each) => order(row, each) < 0);
  if ((at === -1 && edges.after) || (at === 0 && edges.before)) {
    return { pages: without, entered };
  }
  const placed = asAsked(row, query, meta);
  if (at === -1) {
    const last = without.length - 1;
    return {
      pages:
        last < 0 ? [[placed]] : without.map((page, p) => (p === last ? [...page, placed] : page)),
      entered,
    };
  }
  const next = flat[at];
  return {
    pages: without.map((page) => {
      const i = page.findIndex((each) => each === next);
      return i === -1 ? page : [...page.slice(0, i), placed, ...page.slice(i)];
    }),
    entered,
  };
}

/** The pages after a row was deleted, and whether the query kept it (-1) or not (0). */
export function removeRow(
  pages: readonly (readonly Row[])[],
  rowId: Id,
  previous: Previous,
  context: HeldContext,
): { pages: Row[][]; entered: -1 | 0 } {
  const id = context.meta.roles.idField;
  const held = pages.some((page) => page.some((each) => each[id] === rowId));
  const kept = previous === undefined || previous === null ? held : keepsRow(previous, context);
  return {
    pages: pages.map((page) => page.filter((each) => each[id] !== rowId)),
    entered: kept ? -1 : 0,
  };
}

/** A count moved by `by`, never below 0; null stays null. */
function counted(total: number | null, by: number): number | null {
  return total === null ? null : Math.max(0, total + by);
}

/** Rows come before this answer's page: it skips some, or follows a cursor. */
function hasBefore(query: Query): boolean {
  return (query.page?.skip ?? 0) > 0 || query.page?.cursor !== undefined;
}

/** The most rows a numbered page holds: its take, or the resource's default. */
function takeOf(query: Query, meta: ResourceMeta): number {
  return query.page?.take ?? Math.min(100, meta.serves.page.max);
}

/**
 * A held answer after a row was written: the row kept or dropped and in its
 * place, its total moved by what entered or left. A page that grew past its
 * `take` passes its last row on to the next page, which it then has. Undefined
 * when the client can't tell: a grouped answer's counts, an order it can't
 * make here.
 */
export function answerAfterWrite(
  answer: QueryResult,
  row: Row,
  previous: Previous,
  context: HeldContext,
): QueryResult | undefined {
  const { query, meta } = context;
  if (query.group) {
    return undefined;
  }
  const edges = { before: hasBefore(query), after: answer.page.more };
  const placed = placeRow([answer.rows], row, previous, edges, context);
  if (!placed) {
    return undefined;
  }
  const rows = placed.pages.flat();
  const take = takeOf(query, meta);
  const over = rows.length > take;
  return {
    ...answer,
    rows: over ? rows.slice(0, take) : rows,
    page: {
      ...answer.page,
      more: answer.page.more || over,
      total: counted(answer.page.total, placed.entered),
    },
  };
}

/** A held answer after a row was deleted: the row out, its total down when the query kept it. Undefined for a grouped answer. */
export function answerAfterDelete(
  answer: QueryResult,
  id: Id,
  previous: Previous,
  context: HeldContext,
): QueryResult | undefined {
  if (context.query.group) {
    return undefined;
  }
  const removed = removeRow([answer.rows], id, previous, context);
  return {
    ...answer,
    rows: removed.pages.flat(),
    page: { ...answer.page, total: counted(answer.page.total, removed.entered) },
  };
}

/**
 * The pages a cursor brought, one after another from the first, after a row
 * was written: the row kept or dropped and in its place, every page's total
 * moved by what entered or left. A row past the last page held, while
 * another follows, comes with that page when it loads. Undefined when the
 * client can't tell.
 */
export function pagesAfterWrite(
  answers: readonly QueryResult[],
  row: Row,
  previous: Previous,
  context: HeldContext,
): QueryResult[] | undefined {
  if (context.query.group) {
    return undefined;
  }
  const edges = { before: false, after: answers.at(-1)?.page.more ?? false };
  const placed = placeRow(
    answers.map((answer) => answer.rows),
    row,
    previous,
    edges,
    context,
  );
  if (!placed) {
    return undefined;
  }
  return answers.map((answer, index) => {
    return {
      ...answer,
      rows: placed.pages[index] ?? answer.rows,
      page: { ...answer.page, total: counted(answer.page.total, placed.entered) },
    };
  });
}

/** The pages a cursor brought after a row was deleted. Undefined for grouped answers. */
export function pagesAfterDelete(
  answers: readonly QueryResult[],
  id: Id,
  previous: Previous,
  context: HeldContext,
): QueryResult[] | undefined {
  if (context.query.group) {
    return undefined;
  }
  const removed = removeRow(
    answers.map((answer) => answer.rows),
    id,
    previous,
    context,
  );
  return answers.map((answer, index) => {
    return {
      ...answer,
      rows: removed.pages[index] ?? answer.rows,
      page: { ...answer.page, total: counted(answer.page.total, removed.entered) },
    };
  });
}
