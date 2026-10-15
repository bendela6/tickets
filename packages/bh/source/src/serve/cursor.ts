import type { Query, ResourceMeta } from '@bh/resource';
import { hash } from 'ohash';
import { refuse } from '../adapter/errors';

// Our cursor: opaque to a client, and good only for the query that made it.
// It holds what the next page starts after (a source's own cursor, or the
// last row's sort values where bh pages in memory) and the query's
// fingerprint, its filter, search and sort, so a cursor passed to another
// query is refused, never misread.

/** What a cursor is good for: the query's filter, search and sort. */
function fingerprintOf(query: Query, meta: ResourceMeta): string {
  // A stable hash: the same for the same query, whatever its keys' order.
  return hash([query.filter ?? null, query.search ?? null, query.sort ?? meta.sort]);
}

/** Our cursor, holding `after` for this query alone. */
export function cursorOf(after: unknown, query: Query, meta: ResourceMeta): string {
  const payload = JSON.stringify({ q: fingerprintOf(query, meta), after });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/** What our cursor holds, refused when it isn't one, or is another query's. */
export function afterOf(cursor: string, query: Query, meta: ResourceMeta): unknown {
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return refuse('a cursor is the text a page answered, passed back as it was', [
      'page',
      'cursor',
    ]);
  }
  const { q, after } = (payload ?? {}) as { q?: unknown; after?: unknown };
  if (q !== fingerprintOf(query, meta)) {
    return refuse('a cursor is good only for the query that made it', ['page', 'cursor']);
  }
  return after;
}
