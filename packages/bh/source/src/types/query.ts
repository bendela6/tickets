import type { Scalar } from '@bh/resource';
import type { Context } from './context';
import type { Paging } from './paging';
import type { FilterTranslation, SearchTranslation, SortTranslation } from './translation';

// A source's query: one that filters, sorts and pages itself, or one that
// answers every row at once for bh to serve in memory.

/** What a paged source's query is given: its parts, already said in its own words. */
export interface QueryRequest<Request> {
  /** The filter's conditions, joined; absent → every row. */
  filter?: Request;
  /** The search term; absent → none. */
  search?: Request;
  /** One per sort key, in order. */
  sort: Request[];
  /** Which page: the source's own paging. */
  page: Request;
}

/** One group a source counts. */
export interface Counted {
  /** The value its rows hold; null for those that hold none. */
  key: Scalar | null;
  count: number;
}

/**
 * A source that filters, sorts and pages itself: a database, most APIs.
 * Every capability is its translation, and `run` gets only what's declared.
 */
export interface PagedQuery<R, Request, Answer> {
  filter?: FilterTranslation<Request>;
  sort?: SortTranslation<Request>;
  search?: SearchTranslation<Request>;
  /** The fields it counts groups of, and how; absent → it groups none. */
  group?: {
    fields: readonly string[];
    run: (
      request: { filter?: Request; search?: Request; field: string },
      ctx: Context,
    ) => Promise<{ groups: Counted[]; total: number | null }>;
  };
  paging: Paging<Request, Answer>;
  run: (request: QueryRequest<Request>, ctx: Context) => Promise<Answer>;
  /** The records an answer holds, in order. */
  records: (answer: Answer) => readonly R[];
  /** How many rows the filter and search keep, where the source counts them. */
  total?: (answer: Answer) => number | null;
}

/**
 * A source that answers every row at once (a small API, a file): bh filters,
 * searches, sorts, groups and pages them in memory, as each kind's rules say.
 */
export interface WholeQuery<R, Answer> {
  paging: 'none';
  run: (ctx: Context) => Promise<Answer>;
  records: (answer: Answer) => readonly R[];
}
