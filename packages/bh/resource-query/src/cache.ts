import type { InfiniteData, Query as CachedQuery, QueryClient } from '@tanstack/react-query';
import type { Id, Query, QueryResult, ResourceMeta, Row, TitleOf } from '@bh/resource';
import {
  answerAfterDelete,
  answerAfterWrite,
  pagesAfterDelete,
  pagesAfterWrite,
  type HeldContext,
  type Previous,
} from '@bh/resource/client';
import { resourceKeys } from './keys';
import type { ResourceContextValue } from './provider';

// What a write does to the answers React Query holds, without asking the
// server again: the row's own entry is the row the write answered, and each
// list of the resource keeps the row or drops it by its query's filter and
// search, in its place by its order (@bh/resource/client). A list the client
// can't place it in (a group's counts, an order it can't make here) is asked
// again; so is every list, when the metadata can't be had.

type Pages = InfiniteData<QueryResult, string | null>;

/** What a write is applied with: the app's provider, React Query's client and the resource. */
interface Applied extends ResourceContextValue {
  queryClient: QueryClient;
  resource: string;
}

/** The answers of one resource held in the cache, of one kind of key. */
function held(queryClient: QueryClient, key: readonly unknown[]): CachedQuery[] {
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: key })
    .filter((query) => query.state.data !== undefined);
}

/** A held answer's query, the key's last part: a Query, or an InfiniteQuery, which places a row as one. */
function queryOf(query: CachedQuery): Query {
  return (query.queryKey[3] as Query | undefined) ?? {};
}

/** Every row of one resource the cache holds, its own entries first, with the query that brought each. */
function* cachedRows(
  queryClient: QueryClient,
  resource: string,
): Generator<{ row: Row; query?: Query }> {
  for (const query of held(queryClient, resourceKeys.rows(resource))) {
    yield { row: query.state.data as Row };
  }
  for (const query of held(queryClient, resourceKeys.answers(resource))) {
    for (const row of (query.state.data as QueryResult).rows) {
      yield { row, query: queryOf(query) };
    }
  }
  for (const query of held(queryClient, resourceKeys.lists(resource))) {
    for (const page of (query.state.data as Pages).pages) {
      for (const row of page.rows) {
        yield { row, query: queryOf(query) };
      }
    }
  }
}

/**
 * The row as the cache last held it, with every field: its own entry, or a
 * list's whose query asked for every field. Undefined when none holds it.
 */
function previousOf(queryClient: QueryClient, meta: ResourceMeta, id: Id): Previous {
  for (const { row, query } of cachedRows(queryClient, meta.resource)) {
    if (row[meta.roles.idField] === id && !query?.fields) {
      return row;
    }
  }
  return undefined;
}

/**
 * Refs' titles as the cache holds them: the row a ref points at, in any
 * answer of its resource, read by that resource's metadata's titleField.
 * Undefined when the cache holds neither.
 */
export function titlesIn(queryClient: QueryClient): TitleOf {
  return (resource, id) => {
    const meta = queryClient.getQueryData<ResourceMeta>(resourceKeys.meta(resource));
    if (!meta) {
      return undefined;
    }
    for (const { row } of cachedRows(queryClient, resource)) {
      if (row[meta.roles.idField] === id) {
        const title = row[meta.roles.titleField];
        return title === null || title === undefined ? '' : String(title);
      }
    }
    return undefined;
  };
}

/**
 * The resource's metadata, from the cache or else the server, then cached;
 * undefined when it can't be had.
 */
async function metaOf({
  queryClient,
  client,
  resource,
}: Applied): Promise<ResourceMeta | undefined> {
  const key = resourceKeys.meta(resource);
  const cached = queryClient.getQueryData<ResourceMeta>(key);
  if (cached) {
    return cached;
  }
  try {
    const meta = await client.meta(resource);
    queryClient.setQueryData(key, meta);
    return meta;
  } catch {
    return undefined;
  }
}

/** Asks the server again for every list of the resource. */
function refreshLists({ queryClient, resource }: Applied): void {
  void queryClient.invalidateQueries({ queryKey: resourceKeys.answers(resource) });
  void queryClient.invalidateQueries({ queryKey: resourceKeys.lists(resource) });
}

/** Each list of the resource, changed by `answer` and `pages`, or asked again where they can't tell. */
function updateLists(
  applied: Applied,
  meta: ResourceMeta,
  answer: (data: QueryResult, context: HeldContext) => QueryResult | undefined,
  pages: (data: QueryResult[], context: HeldContext) => QueryResult[] | undefined,
): void {
  const { queryClient, resource, registry, viewer } = applied;
  const titleOf = titlesIn(queryClient);
  const contextOf = (query: CachedQuery): HeldContext => {
    return {
      query: queryOf(query),
      meta,
      registry,
      titleOf,
      ...(viewer === undefined ? {} : { viewer }),
    };
  };
  const refresh = (query: CachedQuery) => {
    void queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true });
  };
  for (const query of held(queryClient, resourceKeys.answers(resource))) {
    const next = answer(query.state.data as QueryResult, contextOf(query));
    if (next) {
      queryClient.setQueryData(query.queryKey, next);
    } else {
      refresh(query);
    }
  }
  for (const query of held(queryClient, resourceKeys.lists(resource))) {
    const data = query.state.data as Pages;
    const next = pages(data.pages, contextOf(query));
    if (next) {
      queryClient.setQueryData<Pages>(query.queryKey, { ...data, pages: next });
    } else {
      refresh(query);
    }
  }
}

/**
 * After a write answered `row`: its own entry is the row, and each list of
 * the resource keeps it or drops it, in its place. `previous` is null after a
 * create; otherwise the row as the cache held it before is found here.
 */
export async function rowWritten(applied: Applied, row: Row, previous?: null): Promise<void> {
  const meta = await metaOf(applied);
  if (!meta) {
    refreshLists(applied);
    return;
  }
  const id = row[meta.roles.idField] as Id;
  const before = previous === null ? null : previousOf(applied.queryClient, meta, id);
  updateLists(
    applied,
    meta,
    (data, context) => answerAfterWrite(data, row, before, context),
    (data, context) => pagesAfterWrite(data, row, before, context),
  );
  applied.queryClient.setQueryData(resourceKeys.row(applied.resource, id), row);
}

/** After a delete: the row's own entry is gone, and each list of the resource drops it. */
export async function rowDeleted(applied: Applied, id: Id): Promise<void> {
  const meta = await metaOf(applied);
  if (!meta) {
    refreshLists(applied);
  } else {
    const before = previousOf(applied.queryClient, meta, id);
    updateLists(
      applied,
      meta,
      (data, context) => answerAfterDelete(data, id, before, context),
      (data, context) => pagesAfterDelete(data, id, before, context),
    );
  }
  applied.queryClient.removeQueries({
    queryKey: resourceKeys.row(applied.resource, id),
    exact: true,
  });
}
