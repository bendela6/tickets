import type { OpenAPIV3_1 } from 'openapi-types';
import { describe, expect, it } from 'vitest';
import { ErrorBody } from './errors';
import type { ResourceMeta } from './meta';
import { jsonSchemaOf, openApiOf } from './openapi';
import { Filter, Query } from './query';
import { Row } from './values';

/** Every `$ref` in `node`, as written. */
function refsIn(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const each of node) {
      refsIn(each, found);
    }
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') {
        found.add(value);
      } else {
        refsIn(value, found);
      }
    }
  }
  return found;
}

const write = { create: true, update: true, required: false };
const reads = { filter: [], sort: false, group: false, search: false };

const stacks: ResourceMeta = {
  resource: 'stacks',
  label: { one: 'Stack', other: 'Stacks' },
  roles: { idField: 'id', titleField: 'name', versionField: 'updatedAt' },
  fields: [
    { key: 'id', label: 'Id', type: { kind: 'text' }, query: reads, write },
    { key: 'name', label: 'Name', type: { kind: 'text' }, query: reads, write },
    { key: 'updatedAt', label: 'Updated', type: { kind: 'datetime' }, query: reads, write },
  ],
  sort: [{ field: 'name', dir: 'asc' }],
  serves: {
    read: true,
    create: true,
    update: true,
    delete: true,
    filter: { any: true, not: true },
    sort: { max: 10 },
    page: { numbered: 'any', cursor: true, total: true, max: 500 },
  },
  actions: [
    { name: 'deploy', label: 'Deploy', on: 'row', input: [], long: true },
    { name: 'pause', label: 'Pause', on: 'row', input: [], long: false },
    { name: 'prune', label: 'Prune', on: 'resource', input: [], long: false },
  ],
};

describe('jsonSchemaOf', () => {
  it('makes Filter a $ref to its own definition, which refers to itself', () => {
    const schema = jsonSchemaOf(Filter);
    expect(schema.$ref).toBe('#/$defs/Filter');
    expect(Object.keys(schema.$defs ?? {})).toEqual(['Filter']);
    expect(refsIn(schema.$defs?.Filter)).toEqual(new Set(['#/$defs/Filter']));
  });

  it('takes the input a route receives, its definitions only those it refers to', () => {
    const query = jsonSchemaOf(Query);
    expect(query.type).toBe('object');
    expect(query.additionalProperties).toBe(false);
    expect(Object.keys(query.$defs ?? {})).toEqual(['Filter']);
    expect(query.properties?.search).toEqual({ type: 'string', minLength: 1, maxLength: 200 });
    expect(Object.keys(jsonSchemaOf(Row).$defs ?? {})).toEqual(['Json']);
    expect(jsonSchemaOf(ErrorBody).$defs).toBeUndefined();
  });

  it('keeps the two page shapes apart: neither takes the other’s key', () => {
    const page = jsonSchemaOf(Query).properties?.page;
    expect(JSON.stringify(page)).toContain('"cursor":{"not":{}}');
    expect(JSON.stringify(page)).toContain('"skip":{"not":{}}');
  });
});

describe('openApiOf', () => {
  const doc = openApiOf(stacks, '/api/');
  const paths = doc.paths ?? {};
  const schemas = doc.components?.schemas ?? {};

  it('lists the six routes, each action’s, and the jobs’ when one runs long', () => {
    expect(Object.keys(paths)).toEqual([
      '/api/stacks/meta',
      '/api/stacks/query',
      '/api/stacks',
      '/api/stacks/{id}',
      '/api/stacks/{id}/actions/deploy',
      '/api/stacks/{id}/actions/pause',
      '/api/stacks/actions/prune',
      '/api/jobs/{id}',
    ]);
    expect(Object.keys(paths['/api/stacks/{id}'] ?? {})).toEqual(['get', 'patch', 'delete']);
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Stacks');
    const quiet = openApiOf({ ...stacks, actions: [] }, '/api');
    expect(Object.keys(quiet.paths ?? {})).not.toContain('/api/jobs/{id}');
  });

  it('lists only the writes the resource serves', () => {
    const readOnly = openApiOf(
      { ...stacks, serves: { ...stacks.serves, create: false, update: false, delete: false } },
      '/api',
    );
    expect(Object.keys(readOnly.paths ?? {})).not.toContain('/api/stacks');
    expect(Object.keys(readOnly.paths?.['/api/stacks/{id}'] ?? {})).toEqual(['get']);
  });

  it('names each body and answer, and ErrorBody at every status a route may fail with', () => {
    const operations = Object.values(paths).flatMap((item) => {
      return [item?.get, item?.post, item?.patch, item?.delete].filter(
        (each) => each !== undefined,
      );
    });
    expect(operations).toHaveLength(10);
    for (const operation of operations) {
      const internal = operation.responses?.['500'] as OpenAPIV3_1.ResponseObject;
      expect(refsIn(internal.content)).toEqual(new Set(['#/components/schemas/ErrorBody']));
    }
    const create = paths['/api/stacks']?.post;
    expect(Object.keys(create?.responses ?? {})).toEqual(['201', '400', '409', '500']);
    expect(refsIn(create?.requestBody)).toEqual(new Set(['#/components/schemas/Create']));
    const patch = paths['/api/stacks/{id}']?.patch;
    expect(Object.keys(patch?.responses ?? {})).toEqual(['200', '400', '404', '409', '500']);
    expect(refsIn(paths['/api/stacks/query']?.post?.requestBody)).toEqual(
      new Set(['#/components/schemas/Query']),
    );
  });

  it('deletes by the version in the URL, and makes writes safe to repeat', () => {
    const remove = paths['/api/stacks/{id}']?.delete;
    const names = (remove?.parameters as OpenAPIV3_1.ParameterObject[]).map((each) => each.name);
    expect(names).toEqual(['id', 'version', 'Idempotency-Key']);
    expect(Object.keys(remove?.responses ?? {})).toEqual(['204', '400', '404', '409', '500']);
    const unversioned = openApiOf(
      { ...stacks, roles: { idField: 'id', titleField: 'name' } },
      '/api',
    );
    const parameters = unversioned.paths?.['/api/stacks/{id}']?.delete?.parameters;
    expect((parameters as OpenAPIV3_1.ParameterObject[]).map((each) => each.name)).toEqual([
      'id',
      'Idempotency-Key',
    ]);
  });

  it('answers an action with a job to follow, the row, or nothing', () => {
    const answers = (path: string) => Object.keys(paths[path]?.post?.responses ?? {});
    expect(answers('/api/stacks/{id}/actions/deploy')).toEqual(['202', '400', '404', '500']);
    expect(answers('/api/stacks/{id}/actions/pause')).toEqual(['200', '400', '404', '500']);
    expect(answers('/api/stacks/actions/prune')).toEqual(['204', '400', '404', '500']);
    const job = paths['/api/jobs/{id}']?.get?.responses?.['200'];
    expect(refsIn(job)).toEqual(new Set(['#/components/schemas/Job']));
  });

  it('names every shape a component, each $ref one that is there, Filter referring to itself', () => {
    const missing = [...refsIn(doc)].filter((each) => {
      return !(each.replace('#/components/schemas/', '') in schemas);
    });
    expect(missing).toEqual([]);
    expect(refsIn(schemas.Filter)).toEqual(
      new Set(['#/components/schemas/Filter', '#/components/schemas/Condition']),
    );
    expect(refsIn(schemas.Json)).toEqual(
      new Set(['#/components/schemas/Json', '#/components/schemas/Scalar']),
    );
  });

  it('is plain JSON, as a docs site or a route serves it', () => {
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });
});
