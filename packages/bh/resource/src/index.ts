// The resource contract, shared by servers and browsers, so it imports no
// React and no DOM: a resource's metadata (`GET /api/<resource>/meta`), its
// query (`POST /api/<resource>/query`), its writes and actions, the registries
// of the kinds its fields are of and of the operators that filter them, bh's
// and an app's own, and the one shape of every error. Each shape is a valibot
// schema and a type of one name, the type inferred from the schema; checked
// against one resource's metadata and the registry (metaOf, queryOf…), and
// made into JSON Schema and OpenAPI for the routes and the docs.
export { FieldValue, Id, Json, Row, Scalar } from './values';
export { AttributeMeta, OptionMeta } from './schemas';
export {
  FieldFormat,
  FieldKey,
  FieldMeta,
  FieldQuery,
  FieldType,
  FieldWrite,
  ResourceRoles,
  Template,
  type BaseKind,
  type FieldKind,
  type FormatSpec,
  type KindSettings,
  type KindSpec,
  type KindValue,
  type Operator,
  type OperatorSpec,
} from './types';
export { ResourceMeta } from './meta';
export {
  Condition,
  FieldPath,
  Filter,
  Group,
  GroupBy,
  Page,
  PageResult,
  Query,
  QueryResult,
  Sort,
} from './query';
export { Create, Patch } from './writes';
export { ActionInput, ActionMeta, ActionResult, Job, type JobStatus } from './actions';
export { ErrorBody, Issue, issuesOf, type ErrorCode } from './errors';
export { baseOperators, operatorLabel } from './operators';
export { baseKinds } from './kinds';
export {
  createKindRegistry,
  createOperatorRegistry,
  createRegistry,
  type KindRegistry,
  type OperatorRegistry,
  type Registry,
  type RegistryEntries,
} from './registry';
export { actionInputOf, createOf, metaOf, patchOf, queryOf, rowOf } from './checks';
export { matchesFilter } from './matches';
export { jsonSchemaOf, openApiOf } from './openapi';
export type { JsonSchema } from '@valibot/to-json-schema';
export type { OpenAPIV3_1 } from 'openapi-types';
