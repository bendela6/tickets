import type { ResourceMeta } from '../meta';
import type { Query, QueryResult } from '../query';
import type { Id, Row } from '../values';
import type { Create, Patch } from '../writes';
import { ResourceRequestError } from './errors';

// A typed fetcher for the contract's routes, with no React and no DOM, so a
// browser and a server calling another app's API take the same one:
//
//   GET    <base>/<resource>/meta                → ResourceMeta
//   POST   <base>/<resource>/query      Query    → QueryResult
//   GET    <base>/<resource>/:id                 → Row
//   POST   <base>/<resource>            Create   → 201 Row
//   PATCH  <base>/<resource>/:id        Patch    → Row
//   DELETE <base>/<resource>/:id?version=…       → 204
//
// Every write carries an Idempotency-Key (a uuid), so repeating it with the
// same key is safe; every error answer becomes a ResourceRequestError.

/** What `new Headers()` takes: an object of names, a list of pairs, or Headers. */
export type HeaderValues = ConstructorParameters<typeof Headers>[0];

/** What the client is built with. */
export interface ResourceClientOptions {
  /** Where the routes sit: '/api', or another app's 'https://tickets.example/api'. '/api' when absent. */
  base?: string;
  /** The fetch it calls: a test's, or one that signs each request; the global fetch when absent. */
  fetch?: typeof globalThis.fetch;
  /**
   * Headers every request carries besides the client's own, or a function
   * that answers them for each request: a bearer token that changes.
   */
  headers?: HeaderValues | (() => HeaderValues | Promise<HeaderValues>);
}

/** What one call takes besides its resource and body. */
export interface CallOptions {
  /** Aborts the request: React Query's, when a query is no longer wanted. */
  signal?: AbortSignal;
}

/** What one write takes besides its resource and body. */
export interface WriteOptions extends CallOptions {
  /**
   * Its Idempotency-Key: a fresh uuid when absent. A write sent again with
   * the same key answers the first answer again rather than writing twice.
   */
  idempotencyKey?: string;
}

/** What a delete takes: the row's version as the client read it, which DELETE sends in its URL. */
export interface DeleteOptions extends WriteOptions {
  /** The value of the field `roles.versionField` names; a stale one answers 409 conflict. */
  version?: string;
}

/** A query's answer with its rows typed as the app reads them. */
export interface QueryAnswer<T = Row> extends Omit<QueryResult, 'rows'> {
  /** The page's rows, in the query's order; [] when the query grouped. */
  rows: T[];
}

/**
 * The contract's routes, typed by its shapes. `T` is the app's own type for
 * a row, Row when absent; the server checks each row it answers against the
 * metadata, so the client casts rather than parsing again.
 */
export interface ResourceClient {
  /** GET <base>/<resource>/meta */
  meta(resource: string, options?: CallOptions): Promise<ResourceMeta>;
  /** POST <base>/<resource>/query: {} answers the first page of every row. */
  query<T = Row>(resource: string, query?: Query, options?: CallOptions): Promise<QueryAnswer<T>>;
  /** GET <base>/<resource>/:id */
  read<T = Row>(resource: string, id: Id, options?: CallOptions): Promise<T>;
  /** POST <base>/<resource>: the row as it is after it. */
  create<T = Row>(resource: string, create: Create, options?: WriteOptions): Promise<T>;
  /** PATCH <base>/<resource>/:id: the row as it is after it. */
  update<T = Row>(resource: string, id: Id, patch: Patch, options?: WriteOptions): Promise<T>;
  /** DELETE <base>/<resource>/:id?version=… */
  delete(resource: string, id: Id, options?: DeleteOptions): Promise<void>;
}

/**
 * A fresh Idempotency-Key: a uuid, crypto's own where it has one (a secure
 * context), else made from its random values. A write repeated with the same
 * key answers the first answer again; a mutation that retries keeps its key.
 */
export function idempotencyKey(): string {
  const { crypto } = globalThis;
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Version 4, variant 10: RFC 9562.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** One request, as the client sends it. */
interface Call {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** A write's: it carries an Idempotency-Key. */
  write?: WriteOptions;
  signal?: AbortSignal;
}

/**
 * A client for the contract's routes under `base`. Each method answers the
 * route's body, typed; an error answer throws a ResourceRequestError with its
 * status and the ErrorBody's code, message and issues. A network failure
 * throws as fetch does.
 */
export function resourceClient(options: ResourceClientOptions = {}): ResourceClient {
  const base = (options.base ?? '/api').replace(/\/+$/, '');
  const send = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  const at = (resource: string, ...rest: string[]) => {
    return [base, ...[resource, ...rest].map((part) => encodeURIComponent(part))].join('/');
  };

  async function call(request: Call): Promise<unknown> {
    const given = options.headers;
    const headers = new Headers(typeof given === 'function' ? await given() : given);
    headers.set('accept', 'application/json');
    if (request.body !== undefined) {
      headers.set('content-type', 'application/json');
    }
    if (request.write) {
      headers.set('idempotency-key', request.write.idempotencyKey ?? idempotencyKey());
    }
    const response = await send(request.path, {
      method: request.method,
      headers,
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      ...(request.signal ? { signal: request.signal } : {}),
    });
    const text = await response.text();
    let body: unknown = undefined;
    if (text !== '') {
      try {
        body = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new ResourceRequestError(response.status, {
            code: 'internal',
            message: 'the answer is not JSON',
          });
        }
      }
    }
    if (!response.ok) {
      throw ResourceRequestError.from(response.status, response.statusText, body);
    }
    return body;
  }

  return {
    async meta(resource, { signal } = {}) {
      return (await call({ method: 'GET', path: at(resource, 'meta'), signal })) as ResourceMeta;
    },
    async query<T>(resource: string, query: Query = {}, { signal }: CallOptions = {}) {
      const answer = await call({
        method: 'POST',
        path: at(resource, 'query'),
        body: query,
        signal,
      });
      return answer as QueryAnswer<T>;
    },
    async read<T>(resource: string, id: Id, { signal }: CallOptions = {}) {
      return (await call({ method: 'GET', path: at(resource, String(id)), signal })) as T;
    },
    async create<T>(resource: string, create: Create, write: WriteOptions = {}) {
      const { signal } = write;
      return (await call({ method: 'POST', path: at(resource), body: create, write, signal })) as T;
    },
    async update<T>(resource: string, id: Id, patch: Patch, write: WriteOptions = {}) {
      const { signal } = write;
      const path = at(resource, String(id));
      return (await call({ method: 'PATCH', path, body: patch, write, signal })) as T;
    },
    async delete(resource, id, write = {}) {
      const { signal, version } = write;
      const query = version === undefined ? '' : `?version=${encodeURIComponent(version)}`;
      await call({ method: 'DELETE', path: `${at(resource, String(id))}${query}`, write, signal });
    },
  };
}
