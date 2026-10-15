import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import type { Id, Query, ResourceMeta, Row } from '@bh/resource';
import type { QueryAnswer, ResourceClient } from '@bh/resource/client';
import { resourceKeys, type InfiniteQuery } from './keys';

// Each read as React Query's options, so a route's loader prefetches what a
// hook then reads (queryClient.ensureQueryData(resourceQueryOptions(…))), and
// the hooks are these options in useQuery and useInfiniteQuery.

/** GET /meta, under resourceKeys.meta. */
export function resourceMetaOptions(client: ResourceClient, resource: string) {
  return queryOptions<ResourceMeta>({
    queryKey: resourceKeys.meta(resource),
    queryFn: ({ signal }) => client.meta(resource, { signal }),
  });
}

/** POST /query, one page or its groups, under resourceKeys.answer. */
export function resourceQueryOptions<T = Row>(
  client: ResourceClient,
  resource: string,
  query: Query = {},
) {
  return queryOptions<QueryAnswer<T>>({
    queryKey: resourceKeys.answer(resource, query),
    queryFn: ({ signal }) => client.query<T>(resource, query, { signal }),
  });
}

/** The page a list asks for: the first, of `take` rows, or the one after a cursor. */
function pageOf(cursor: string | null, take: number | undefined): Pick<Query, 'page'> {
  const size = take === undefined ? {} : { take };
  if (cursor !== null) {
    return { page: { cursor, ...size } };
  }
  return take === undefined ? {} : { page: size };
}

/**
 * POST /query page after page, each after the cursor the one before answered
 * (`page.next`), under resourceKeys.list: a list that grows as it scrolls.
 */
export function resourceInfiniteQueryOptions<T = Row>(
  client: ResourceClient,
  resource: string,
  query: InfiniteQuery = {},
) {
  const { take, ...rest } = query;
  return infiniteQueryOptions<
    QueryAnswer<T>,
    Error,
    InfiniteData<QueryAnswer<T>, string | null>,
    QueryKey,
    string | null
  >({
    queryKey: resourceKeys.list(resource, query),
    queryFn: ({ pageParam, signal }) => {
      return client.query<T>(resource, { ...rest, ...pageOf(pageParam, take) }, { signal });
    },
    initialPageParam: null,
    getNextPageParam: (last: QueryAnswer<T>) => last.page.next ?? undefined,
  });
}

/** GET /:id, under resourceKeys.row. */
export function resourceRowOptions<T = Row>(client: ResourceClient, resource: string, id: Id) {
  return queryOptions<T>({
    queryKey: resourceKeys.row(resource, id),
    queryFn: ({ signal }) => client.read<T>(resource, id, { signal }),
  });
}
