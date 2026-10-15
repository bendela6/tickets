// @bh/resource-query: React Query's hooks for the resource contract's routes,
// on @bh/resource/client's fetcher. A ResourceProvider gives them the client,
// the registry and who is viewing; each hook reads a resource by its name
// (its metadata, a query's page or groups, the pages a cursor brings, one
// row) or writes one, and a write puts the row it answers in each list the
// cache holds, or takes it out, without asking the server again.
export {
  ResourceProvider,
  useResourceContext,
  type ResourceContextValue,
  type ResourceProviderProps,
} from './provider';
export {
  useCreateRow,
  useDeleteRow,
  useResourceInfiniteQuery,
  useResourceMeta,
  useResourceQuery,
  useResourceRow,
  useUpdateRow,
  type DeleteRow,
  type InfiniteOptions,
  type ReadOptions,
  type UpdateRow,
  type WriteOptions,
} from './hooks';
export {
  resourceInfiniteQueryOptions,
  resourceMetaOptions,
  resourceQueryOptions,
  resourceRowOptions,
} from './options';
export { resourceKeys, type InfiniteQuery } from './keys';
