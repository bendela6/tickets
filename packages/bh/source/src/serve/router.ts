import type { Id } from '@bh/resource';
import { ResourceError } from '../adapter/errors';
import type { ServedResource } from './serve';
import type { Context } from '../types/context';

// The contract's routes over served resources, with no web framework: an
// app hands each request's method, path (below its base, '/api'), query and
// body to `route`, and sends back the status and body it answers. Fastify,
// Hono, Express or a plain node:http server each take it in a few lines.
//
//   GET    /<resource>/meta
//   POST   /<resource>/query
//   GET    /<resource>/:id
//   POST   /<resource>
//   PATCH  /<resource>/:id
//   DELETE /<resource>/:id?version=…

export interface RouteRequest {
  method: string;
  /** Below the API's base: '/issues/7'. */
  path: string;
  /** The URL's query: DELETE's `version`. */
  query?: Readonly<Record<string, string | undefined>>;
  body?: unknown;
  ctx?: Context;
}

export interface RouteAnswer {
  status: number;
  /** None for 204. */
  body?: unknown;
}

/** A path's id as the resource's id field holds it: a whole number, or text. */
function idOf(resource: ServedResource, segment: string): Id {
  const field = resource.meta.fields.find((each) => each.key === resource.meta.roles.idField);
  if (field?.type.kind === 'number') {
    const id = Number(segment);
    if (!Number.isSafeInteger(id)) {
      throw new ResourceError('invalid', 'an id is a whole number', [
        { path: ['id'], message: 'an id is a whole number' },
      ]);
    }
    return id;
  }
  return decodeURIComponent(segment);
}

/** The routes of these resources: one function a server hands each request. */
export function router(
  resources: readonly ServedResource[],
): (request: RouteRequest) => Promise<RouteAnswer> {
  const byName = new Map(resources.map((resource) => [resource.meta.resource, resource]));
  return async (request) => {
    const [name = '', rest, ...beyond] = request.path.replace(/^\/+|\/+$/g, '').split('/');
    const resource = byName.get(name);
    const method = request.method.toUpperCase();
    const { ctx = {} } = request;
    try {
      if (!resource || beyond.length > 0) {
        throw new ResourceError('not_found', `no such route: ${method} ${request.path}`);
      }
      if (rest === undefined) {
        if (method === 'POST') {
          return { status: 201, body: await resource.create(request.body, ctx) };
        }
      } else if (rest === 'meta' && method === 'GET') {
        return { status: 200, body: resource.meta };
      } else if (rest === 'query' && method === 'POST') {
        return { status: 200, body: await resource.query(request.body ?? {}, ctx) };
      } else if (method === 'GET') {
        return { status: 200, body: await resource.read(idOf(resource, rest), ctx) };
      } else if (method === 'PATCH') {
        return {
          status: 200,
          body: await resource.update(idOf(resource, rest), request.body, ctx),
        };
      } else if (method === 'DELETE') {
        await resource.delete(idOf(resource, rest), request.query?.['version'], ctx);
        return { status: 204 };
      }
      throw new ResourceError('not_found', `no such route: ${method} ${request.path}`);
    } catch (error) {
      if (error instanceof ResourceError) {
        return { status: error.status, body: error.body };
      }
      return { status: 500, body: new ResourceError('internal', 'the server failed').body };
    }
  };
}
