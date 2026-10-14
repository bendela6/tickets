import { toJsonSchema, toJsonSchemaDefs, type JsonSchema } from '@valibot/to-json-schema';
import type { OpenAPIV3_1 } from 'openapi-types';
import type * as v from 'valibot';
import { ActionInput, ActionMeta, ActionResult, Job } from './actions';
import { ErrorBody, Issue } from './errors';
import { ResourceMeta } from './meta';
import {
  Condition,
  filterShapes,
  Group,
  GroupBy,
  Page,
  PageResult,
  Query,
  QueryResult,
  Sort,
} from './query';
import { FieldMeta } from './types';
import { FieldValue, Id, Json, Row, Scalar } from './values';
import { Create, Patch } from './writes';

// The contract for the routes and the docs: its schemas as JSON Schema, and a
// resource's routes as an OpenAPI document, made from the valibot schemas so
// they can't drift, as items-core's `to-fastify-schema` makes its routes'.
// Each takes a schema's input, what the route receives over the wire. A check
// JSON Schema can't say (a date's day, a url's host, metaOf's and queryOf's)
// is left out of it: the server still runs it, and answers `invalid`.

/** The shapes that hold themselves, named so their JSON Schema refers to itself. */
const recursive = { Filter: filterShapes, Json };

const RECURSIVE_REF = '#/$defs/';

/** Drops the definitions nothing in `schema` refers to, directly or through another. */
function pruned(schema: JsonSchema): JsonSchema {
  const { $defs = {}, ...rest } = schema;
  const used = new Set<string>();
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (typeof node === 'object' && node !== null) {
      for (const [key, value] of Object.entries(node)) {
        const name =
          key === '$ref' && typeof value === 'string' && value.startsWith(RECURSIVE_REF)
            ? value.slice(RECURSIVE_REF.length)
            : undefined;
        if (name !== undefined && !used.has(name)) {
          used.add(name);
          visit($defs[name]);
        } else if (key !== '$defs') {
          visit(value);
        }
      }
    }
  };
  visit(rest);
  const kept = Object.entries($defs).filter(([name]) => used.has(name));
  return kept.length === 0 ? rest : { ...rest, $defs: Object.fromEntries(kept) };
}

/**
 * A schema as JSON Schema (draft-07), through @valibot/to-json-schema: the
 * shape a route receives. Filter and Json, which hold themselves, come out as
 * a `$ref` to their own definition in `$defs`, which holds only what the
 * schema refers to.
 */
export function jsonSchemaOf(schema: v.GenericSchema): JsonSchema {
  return pruned(
    toJsonSchema(schema, { typeMode: 'input', errorMode: 'ignore', definitions: recursive }),
  );
}

/**
 * The shapes an OpenAPI document names in its components, each the same for
 * every resource.
 */
const components = {
  ResourceMeta,
  FieldMeta,
  ActionMeta,
  Query,
  Filter: filterShapes,
  Condition,
  Sort,
  Page,
  GroupBy,
  QueryResult,
  Group,
  PageResult,
  Row,
  FieldValue,
  Scalar,
  Json,
  Id,
  Create,
  Patch,
  ActionInput,
  ActionResult,
  Job,
  ErrorBody,
  Issue,
};

type Named = keyof typeof components;

const COMPONENT_REF = '#/components/schemas/';

/** The components' schemas, each referring to the others by name. */
function componentSchemas(): Record<Named, OpenAPIV3_1.SchemaObject> {
  const schemas = toJsonSchemaDefs(components, {
    target: 'draft-2020-12',
    typeMode: 'input',
    errorMode: 'ignore',
    overrideRef: ({ referenceId }) => `${COMPONENT_REF}${referenceId}`,
  });
  return schemas as Record<Named, OpenAPIV3_1.SchemaObject>;
}

function ref(name: Named): OpenAPIV3_1.ReferenceObject {
  return { $ref: `${COMPONENT_REF}${name}` };
}

/** A JSON body of a named shape, or of the schema given. */
function content(
  schema: Named | OpenAPIV3_1.SchemaObject,
): Record<string, OpenAPIV3_1.MediaTypeObject> {
  return { 'application/json': { schema: typeof schema === 'string' ? ref(schema) : schema } };
}

/** `{ job: Job }`: what a long action answers, and GET /jobs/:id. */
const jobAnswer: OpenAPIV3_1.SchemaObject = {
  type: 'object',
  properties: { job: ref('Job') },
  required: ['job'],
  additionalProperties: false,
};

/** The statuses ErrorBody answers, each with its code (ErrorCode). */
const FAILURES = {
  400: 'invalid: the body, a parameter or a cursor is wrong; `issues` says where',
  404: 'not_found: no such row, or no such resource',
  409: 'conflict: the version is stale, or a value that must be unique is taken',
  500: 'internal: nothing the caller can fix; the message says no more',
};

/** ErrorBody at each of `statuses`, and at 500, which every route may answer. */
function failures(...statuses: (400 | 404 | 409)[]): OpenAPIV3_1.ResponsesObject {
  const answers = [...statuses, 500 as const].map((status) => {
    return [String(status), { description: FAILURES[status], content: content('ErrorBody') }];
  });
  return Object.fromEntries(answers) as OpenAPIV3_1.ResponsesObject;
}

const idempotencyKey: OpenAPIV3_1.ParameterObject = {
  name: 'Idempotency-Key',
  in: 'header',
  required: false,
  description:
    'A uuid that makes the request safe to repeat: the same key answers the first answer again.',
  schema: { type: 'string', format: 'uuid' },
};

const rowId: OpenAPIV3_1.ParameterObject = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'The row’s id.',
  schema: ref('Id'),
};

/** A document's routes: each path's operations, by method. */
type Paths = Record<
  string,
  Partial<Record<'get' | 'post' | 'patch' | 'delete', OpenAPIV3_1.OperationObject>>
>;

/** An action's route and what it answers: the row, nothing, or a job to follow. */
function actionOperation(
  meta: ResourceMeta,
  action: ActionMeta,
  tag: string,
): OpenAPIV3_1.OperationObject {
  const done: OpenAPIV3_1.ResponsesObject = action.long
    ? { 202: { description: 'It runs long: the job to follow.', content: content(jobAnswer) } }
    : action.on === 'row'
      ? { 200: { description: 'The row as it is after it.', content: content('Row') } }
      : { 204: { description: 'Done.' } };
  return {
    operationId: `${meta.resource}.actions.${action.name}`,
    summary: `${meta.label.other}: ${action.label}`,
    tags: [tag],
    parameters: action.on === 'row' ? [rowId, idempotencyKey] : [idempotencyKey],
    requestBody: { required: true, content: content('ActionInput') },
    responses: { ...done, ...failures(400, 404) },
  };
}

/**
 * A resource's routes as an OpenAPI 3.1 document, under `basePath` ('/api'):
 * its metadata, its query, reading one row, its create, patch and delete, and
 * its actions, with GET /jobs/:id when one runs long. Each names its body
 * and its answer, ErrorBody at the statuses it may fail with, and every
 * shape is a component, the same for every resource: what a field holds is
 * the metadata's to say, at GET /meta.
 */
export function openApiOf(meta: ResourceMeta, basePath: string): OpenAPIV3_1.Document {
  const root = basePath.replace(/\/+$/, '');
  const base = `${root}/${meta.resource}`;
  const tag = meta.label.other;
  const operation = (
    name: string,
    summary: string,
    rest: Omit<OpenAPIV3_1.OperationObject, 'operationId' | 'summary' | 'tags'>,
  ): OpenAPIV3_1.OperationObject => {
    return {
      operationId: `${meta.resource}.${name}`,
      summary: `${tag}: ${summary}`,
      tags: [tag],
      ...rest,
    };
  };
  const version: OpenAPIV3_1.ParameterObject[] = meta.roles.versionField
    ? [
        {
          name: 'version',
          in: 'query',
          required: false,
          description: `The row’s version as the client read it (its ${meta.roles.versionField}): a stale one answers 409 conflict and nothing is deleted.`,
          schema: { type: 'string' },
        },
      ]
    : [];

  const paths: Paths = {
    [`${base}/meta`]: {
      get: operation('meta', 'metadata', {
        responses: {
          200: {
            description: 'Its fields, roles, sort and actions.',
            content: content('ResourceMeta'),
          },
          ...failures(),
        },
      }),
    },
    [`${base}/query`]: {
      post: operation('query', 'query', {
        requestBody: { required: true, content: content('Query') },
        responses: {
          200: { description: 'A page of rows, or the groups.', content: content('QueryResult') },
          ...failures(400),
        },
      }),
    },
    [base]: {
      post: operation('create', 'create', {
        parameters: [idempotencyKey],
        requestBody: { required: true, content: content('Create') },
        responses: {
          201: { description: 'The new row.', content: content('Row') },
          ...failures(400, 409),
        },
      }),
    },
    [`${base}/{id}`]: {
      get: operation('get', 'read one', {
        parameters: [rowId],
        responses: {
          200: { description: 'The row.', content: content('Row') },
          ...failures(400, 404),
        },
      }),
      patch: operation('update', 'update', {
        parameters: [rowId, idempotencyKey],
        requestBody: { required: true, content: content('Patch') },
        responses: {
          200: { description: 'The row as it is after it.', content: content('Row') },
          ...failures(400, 404, 409),
        },
      }),
      delete: operation('delete', 'delete', {
        parameters: [rowId, ...version, idempotencyKey],
        responses: { 204: { description: 'Deleted.' }, ...failures(400, 404, 409) },
      }),
    },
  };

  for (const action of meta.actions) {
    const path =
      action.on === 'row'
        ? `${base}/{id}/actions/${action.name}`
        : `${base}/actions/${action.name}`;
    paths[path] = { post: actionOperation(meta, action, tag) };
  }
  if (meta.actions.some((action) => action.long)) {
    paths[`${root}/jobs/{id}`] = {
      get: {
        operationId: 'jobs.get',
        summary: 'Jobs: read one',
        tags: ['Jobs'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'The job’s id, as the action answered it.',
            schema: { type: 'string', minLength: 1 },
          },
        ],
        responses: {
          200: { description: 'The job, whatever its status.', content: content(jobAnswer) },
          ...failures(404),
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: { title: tag, version: '1' },
    // openapi-types' 3.1 path item also asks each operation to be a 3.0 one,
    // which a 3.1 schema isn't; the operations are 3.1's, as the document is.
    paths: paths as OpenAPIV3_1.PathsObject,
    components: { schemas: componentSchemas() },
  };
}
