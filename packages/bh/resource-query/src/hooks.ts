import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryOptions,
  type UseInfiniteQueryResult,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { Create, Id, Patch, Query, ResourceMeta, Row } from '@bh/resource';
import { idempotencyKey, type QueryAnswer } from '@bh/resource/client';
import { rowDeleted, rowWritten } from './cache';
import type { InfiniteQuery } from './keys';
import {
  resourceInfiniteQueryOptions,
  resourceMetaOptions,
  resourceQueryOptions,
  resourceRowOptions,
} from './options';
import { useResourceContext } from './provider';

// React Query's hooks for one resource's routes, by its name: its metadata,
// a query's page or groups, the pages a cursor brings, one row, and the
// writes. A write answers the row after it, and each list the cache holds
// keeps or drops it in its place without asking the server again (cache.ts).

/** What a read hook takes besides its query: React Query's options, but its key and its function. */
export type ReadOptions<T> = Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey' | 'queryFn'>;

/** What useResourceInfiniteQuery takes besides its query. */
export type InfiniteOptions<T> = Omit<
  UseInfiniteQueryOptions<
    QueryAnswer<T>,
    Error,
    InfiniteData<QueryAnswer<T>, string | null>,
    QueryKey,
    string | null
  >,
  'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>;

/** What a write hook takes: React Query's options, but its function. */
export type WriteOptions<T, Variables> = Omit<
  UseMutationOptions<T, Error, Variables>,
  'mutationFn'
>;

/** What useUpdateRow's mutate takes: the row's id, the values that change, and the version read. */
export interface UpdateRow extends Patch {
  id: Id;
}

/** What useDeleteRow's mutate takes: the row's id, and the version read. */
export interface DeleteRow {
  id: Id;
  /** The value of the field `roles.versionField` names; a stale one answers 409 conflict. */
  version?: string;
}

// One Idempotency-Key per call of mutate, kept by its variables until the
// write settles: a mutation React Query retries is the same write to the
// server, and a later mutate of the same object a new one.
const keys = new WeakMap<object, string>();

function keyOf(variables: object): string {
  let key = keys.get(variables);
  if (key === undefined) {
    key = idempotencyKey();
    keys.set(variables, key);
  }
  return key;
}

/** The app's options, the write's key forgotten once it settles, then the app's onSettled. */
function settling<T, Variables extends object>(
  options: WriteOptions<T, Variables>,
): WriteOptions<T, Variables> {
  type Settled = Parameters<NonNullable<WriteOptions<T, Variables>['onSettled']>>;
  return {
    ...options,
    onSettled: (...args: Settled) => {
      keys.delete(args[2]);
      return options.onSettled?.(...args);
    },
  };
}

/** GET /meta: which fields a resource has, and what a query and a write may do with each. */
export function useResourceMeta(
  resource: string,
  options: ReadOptions<ResourceMeta> = {},
): UseQueryResult<ResourceMeta> {
  const { client } = useResourceContext();
  return useQuery({ ...options, ...resourceMetaOptions(client, resource) });
}

/**
 * POST /query: one page of rows, numbered (`page: {skip, take}`) or the one
 * after a cursor, or a grouped query's groups and their counts.
 */
export function useResourceQuery<T = Row>(
  resource: string,
  query: Query = {},
  options: ReadOptions<QueryAnswer<T>> = {},
): UseQueryResult<QueryAnswer<T>> {
  const { client } = useResourceContext();
  return useQuery({ ...options, ...resourceQueryOptions<T>(client, resource, query) });
}

/**
 * POST /query page after page, each after the cursor the one before
 * answered: a list that grows as it scrolls. `fetchNextPage` brings the next
 * while `hasNextPage` is true.
 */
export function useResourceInfiniteQuery<T = Row>(
  resource: string,
  query: InfiniteQuery = {},
  options: InfiniteOptions<T> = {},
): UseInfiniteQueryResult<InfiniteData<QueryAnswer<T>, string | null>> {
  const { client } = useResourceContext();
  return useInfiniteQuery({
    ...options,
    ...resourceInfiniteQueryOptions<T>(client, resource, query),
  });
}

/** GET /:id: one row. */
export function useResourceRow<T = Row>(
  resource: string,
  id: Id,
  options: ReadOptions<T> = {},
): UseQueryResult<T> {
  const { client } = useResourceContext();
  return useQuery({ ...options, ...resourceRowOptions<T>(client, resource, id) });
}

/** What the write hooks apply a write's answer with. */
function useApplied(resource: string) {
  const context = useResourceContext();
  const queryClient = useQueryClient();
  return { ...context, queryClient, resource };
}

/**
 * POST: creates a row from `{ values }`. The row it answers is cached, and
 * goes into each list the cache holds whose query keeps it, in its place.
 */
export function useCreateRow<T = Row>(
  resource: string,
  options: WriteOptions<T, Create> = {},
): UseMutationResult<T, Error, Create> {
  const applied = useApplied(resource);
  return useMutation({
    ...settling(options),
    mutationFn: async (create: Create) => {
      const row = await applied.client.create<T>(resource, create, {
        idempotencyKey: keyOf(create),
      });
      await rowWritten(applied, row as Row, null);
      return row;
    },
  });
}

/**
 * PATCH: changes a row's values, `{ id, values, version? }`. The row it
 * answers replaces the cached one, and each list the cache holds keeps it,
 * moves it, or drops it when its query no longer keeps it.
 */
export function useUpdateRow<T = Row>(
  resource: string,
  options: WriteOptions<T, UpdateRow> = {},
): UseMutationResult<T, Error, UpdateRow> {
  const applied = useApplied(resource);
  return useMutation({
    ...settling(options),
    mutationFn: async (update: UpdateRow) => {
      const { id, ...patch } = update;
      const row = await applied.client.update<T>(resource, id, patch, {
        idempotencyKey: keyOf(update),
      });
      await rowWritten(applied, row as Row);
      return row;
    },
  });
}

/** DELETE: deletes a row, `{ id, version? }`, and takes it out of every list the cache holds. */
export function useDeleteRow(
  resource: string,
  options: WriteOptions<void, DeleteRow> = {},
): UseMutationResult<void, Error, DeleteRow> {
  const applied = useApplied(resource);
  return useMutation({
    ...settling(options),
    mutationFn: async (remove: DeleteRow) => {
      await applied.client.delete(resource, remove.id, {
        idempotencyKey: keyOf(remove),
        ...(remove.version === undefined ? {} : { version: remove.version }),
      });
      await rowDeleted(applied, remove.id);
    },
  });
}
