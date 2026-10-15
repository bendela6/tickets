import type { Id, Query } from '@bh/resource';

// The keys React Query keeps a resource's answers under, all below one root,
// so an app refreshes one resource's answers, or every resource's, by its
// prefix: queryClient.invalidateQueries({ queryKey: resourceKeys.of('tasks') }).

const ROOT = '@bh/resource';

/**
 * A query whose pages a cursor brings, one after another, as a list grows
 * while it scrolls: a Query without its page, which the hook asks for, nor a
 * group, which has no pages. `take` is each page's size.
 */
export interface InfiniteQuery extends Omit<Query, 'page' | 'group'> {
  /** Rows per page: 1 to 500; 100, or the resource's most, when absent. */
  take?: number;
}

/** Every key the hooks keep a resource's answers under. */
export const resourceKeys = {
  /** Every answer of every resource. */
  all: () => [ROOT] as const,
  /** Every answer of one resource: its metadata, its queries, its rows. */
  of: (resource: string) => [ROOT, resource] as const,
  /** GET /meta */
  meta: (resource: string) => [ROOT, resource, 'meta'] as const,
  /** Every query's answer of one page, numbered or after a cursor, or its groups. */
  answers: (resource: string) => [ROOT, resource, 'query'] as const,
  /** One query's answer. */
  answer: (resource: string, query: Query) => [ROOT, resource, 'query', query] as const,
  /** Every list of pages a cursor brought. */
  lists: (resource: string) => [ROOT, resource, 'infinite'] as const,
  /** One query's pages. */
  list: (resource: string, query: InfiniteQuery) => [ROOT, resource, 'infinite', query] as const,
  /** Every row read alone. */
  rows: (resource: string) => [ROOT, resource, 'row'] as const,
  /** GET /:id */
  row: (resource: string, id: Id) => [ROOT, resource, 'row', id] as const,
};
