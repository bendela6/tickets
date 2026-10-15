// Where a resource's rows live, and how it serves each operation: a
// database, an external API, a file. A source declares each operation apart
// (query, read, create, update, delete), each capability as its translation
// into the source's own words; `serve` makes the resource's metadata from
// them and the kinds, checks each request against it and each row the
// source answers, and serves in memory a source that answers every row at
// once. `router` puts the contract's routes over served resources, with no
// web framework. The conformance check for an adapter's tests is
// @bh/source/testing.
export { serve, type ServeOptions, type ServedResource } from './serve/serve';
export { router, type RouteAnswer, type RouteRequest } from './serve/router';
export { conflict, notFound, refuse, ResourceError } from './adapter/errors';
export { valuesOf } from './adapter/operands';
export { metaFrom } from './serve/meta';
export type { Context } from './types/context';
export type { FieldDefinition, ResourceDefinition } from './types/definition';
export type {
  FilterTranslation,
  Operand,
  SearchTranslation,
  SortTranslation,
} from './types/translation';
export type { Paging } from './types/paging';
export type { Counted, PagedQuery, QueryRequest, WholeQuery } from './types/query';
export type {
  CreateOperation,
  DeleteOperation,
  ReadOperation,
  UpdateOperation,
  WriteField,
} from './types/operations';
export type { Source, SourceFactory } from './types/source';
