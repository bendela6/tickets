import * as v from 'valibot';
import {
  createOf,
  createRegistry,
  issuesOf,
  patchOf,
  queryOf,
  rowOf,
  type FieldValue,
  type Filter,
  type Id,
  type Query,
  type QueryResult,
  type Registry,
  type ResourceMeta,
  type Row,
} from '@bh/resource';
import { afterOf, cursorOf } from './cursor';
import { notFound, refuse, ResourceError } from '../adapter/errors';
import { groupsOf } from '../memory/groups';
import { queryInMemory } from '../memory/query';
import { isWhole, metaFrom } from './meta';
import type { Context } from '../types/context';
import type { ResourceDefinition } from '../types/definition';
import type { PagedQuery } from '../types/query';
import type { Source, SourceFactory } from '../types/source';
import type { FilterTranslation } from '../types/translation';

// A resource served from its source: its metadata made from what the source
// declares, and each operation checked in, said in the source's own words,
// and its rows checked out. Validation runs at four points: the source's
// declarations when it's served (metaFrom); each request against the
// metadata, then the operation's own check; each row the source answers
// (rowOf); and, in an adapter's tests, each operator it declares against
// matchesFilter (@bh/source/testing).

export interface ServeOptions {
  /** bh's kinds and operators and the app's own; bh's alone when absent. */
  registry?: Registry;
  /**
   * Whether each row the source answers is checked against the metadata:
   * 'always', the default, for an external API, which changes under you;
   * 'never' where the source can't answer out of shape and the cost tells.
   */
  checkRows?: 'always' | 'never';
  /** Where a failure the caller can't fix is told, with its detail; console.error when absent. */
  log?: (message: string, detail: unknown) => void;
}

/** A resource as a route serves it: each operation takes the request's body and answers its result, or throws a ResourceError. */
export interface ServedResource {
  readonly meta: ResourceMeta;
  query: (body: unknown, ctx?: Context) => Promise<QueryResult>;
  read: (id: Id, ctx?: Context) => Promise<Row>;
  create: (body: unknown, ctx?: Context) => Promise<Row>;
  update: (id: Id, body: unknown, ctx?: Context) => Promise<Row>;
  delete: (id: Id, version?: string, ctx?: Context) => Promise<void>;
}

/** The body, as `schema` takes it, or 400 invalid with every problem at its path. */
function parsed<T>(schema: v.GenericSchema<T>, body: unknown, message: string): T {
  const result = v.safeParse(schema, body);
  if (!result.success) {
    throw new ResourceError('invalid', message, issuesOf(result.issues));
  }
  return result.output;
}

/** The filter, said as the source's request: each condition's translation, joined as it declares. */
function translated<Request>(
  filter: Filter,
  translation: FilterTranslation<Request>,
  ctx: Context,
  at: (string | number)[],
): Request {
  if ('all' in filter) {
    return translation.all(
      filter.all.map((each, index) => translated(each, translation, ctx, [...at, 'all', index])),
    );
  }
  if ('any' in filter) {
    const any =
      translation.any ?? refuse('the source joins conditions by "all" alone', [...at, 'any']);
    return any(
      filter.any.map((each, index) => translated(each, translation, ctx, [...at, 'any', index])),
    );
  }
  if ('not' in filter) {
    const not =
      translation.not ?? refuse('the source joins conditions by "all" alone', [...at, 'not']);
    return not(translated(filter.not, translation, ctx, [...at, 'not']));
  }
  const send = translation.fields[filter.field]?.[filter.op];
  if (!send) {
    return refuse(`the source can't filter "${filter.field}" by "${filter.op}"`, [...at, 'op']);
  }
  return send(filter.value, ctx);
}

/** The value a field holds as a row carries it: a many field's [] for none, null for a value's none. */
function settled(value: FieldValue | undefined, many: boolean): FieldValue {
  if (value === undefined || value === null) {
    return many ? [] : null;
  }
  return value;
}

/**
 * Serves a resource from its source, or from the source a factory makes for
 * it (a database adapter's, from its columns). Throws, listing every
 * mistake, on a source whose declarations its kinds and fields don't allow.
 */
export function serve<R, Request, Answer, Body>(
  definition: ResourceDefinition,
  given: Source<R, Request, Answer, Body> | SourceFactory<R, Request, Answer, Body>,
  options: ServeOptions = {},
): ServedResource {
  const registry = options.registry ?? createRegistry();
  const source = typeof given === 'function' ? given(definition, registry) : given;
  const meta = metaFrom(definition, source, registry);
  const log =
    options.log ??
    ((message: string, detail: unknown) => {
      console.error(message, detail);
    });
  const schemas = {
    query: queryOf(meta, registry),
    create: createOf(meta, registry),
    patch: patchOf(meta, registry),
    row: rowOf(meta, registry),
  };
  const many = new Map(meta.fields.map((field) => [field.key, field.type.many === true]));
  const name = definition.resource;

  /** Runs the source, its own errors answered as they are, any other answering internal. */
  async function guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof ResourceError) {
        throw error;
      }
      log(`${name}: the source failed`, error);
      throw new ResourceError('internal', 'the source failed');
    }
  }

  /** A record as a row of ours, checked against the metadata unless told not to. */
  function rowFrom(record: R): Row {
    const row: Row = {};
    for (const [key, read] of Object.entries(source.row)) {
      row[key] = settled(read(record), many.get(key) === true);
    }
    if (options.checkRows !== 'never') {
      const checked = v.safeParse(schemas.row, row);
      if (!checked.success) {
        log(`${name}: the source answered a row out of shape`, issuesOf(checked.issues));
        throw new ResourceError('internal', 'the source answered a row out of shape');
      }
    }
    return row;
  }

  /** A row with only the fields a query asked for, and those that name it. */
  function trimmed(row: Row, fields: readonly string[] | undefined): Row {
    if (!fields) {
      return row;
    }
    const roles = Object.values(meta.roles).filter((key) => key !== undefined);
    const kept = new Set([...fields, ...roles]);
    return Object.fromEntries(Object.entries(row).filter(([key]) => kept.has(key)));
  }

  async function queryPaged(
    query: Query,
    paged: PagedQuery<R, Request, Answer>,
    ctx: Context,
  ): Promise<QueryResult> {
    const filter =
      query.filter && paged.filter
        ? translated(query.filter, paged.filter, ctx, ['filter'])
        : query.filter && !('all' in query.filter && query.filter.all.length === 0)
          ? refuse('the source filters by no field', ['filter'])
          : undefined;
    const search = query.search !== undefined ? paged.search?.send(query.search) : undefined;
    if (query.group) {
      const group = paged.group ?? refuse('the source groups by no field', ['group']);
      const counted = await guarded(() => {
        return group.run(
          {
            field: query.group?.field ?? '',
            ...(filter === undefined ? {} : { filter }),
            ...(search === undefined ? {} : { search }),
          },
          ctx,
        );
      });
      return {
        rows: [],
        groups: groupsOf(counted.groups, query.group, meta, registry),
        page: { next: null, more: false, total: counted.total },
      };
    }
    const sort = (query.sort ?? meta.sort).map(({ field, dir }, index) => {
      const send =
        paged.sort?.fields[field] ??
        refuse(`the source can't sort by "${field}"`, ['sort', index, 'field']);
      return send(dir);
    });
    const { paging } = paged;
    const take = query.page?.take ?? Math.min(100, meta.serves.page.max);
    const skip = query.page?.skip ?? 0;
    let page: Request;
    if (query.page?.cursor !== undefined) {
      const cursor = paging.cursor ?? refuse('the source pages by number', ['page', 'cursor']);
      page = cursor.send(String(afterOf(query.page.cursor, query, meta)), take);
    } else if (paging.offset) {
      page = paging.offset(skip, take);
    } else if (paging.page) {
      page = paging.page(Math.floor(skip / take) + 1, take);
    } else if (paging.cursor) {
      page = paging.cursor.send(undefined, take);
    } else {
      return refuse('the source pages no way', ['page']);
    }
    const request = {
      sort,
      page,
      ...(filter === undefined ? {} : { filter }),
      ...(search === undefined ? {} : { search }),
    };
    const answer = await guarded(() => paged.run(request, ctx));
    const records = paged.records(answer);
    const rows = records.map((record) => trimmed(rowFrom(record), query.fields));
    const theirs = paging.cursor ? paging.cursor.next(answer) : null;
    const next = theirs === null ? null : cursorOf(theirs, query, meta);
    const total = paged.total ? paged.total(answer) : null;
    const numbered = query.page?.cursor === undefined;
    const more =
      paging.cursor !== undefined
        ? next !== null
        : total !== null && numbered
          ? skip + take < total
          : (paging.more?.(answer) ?? records.length >= take);
    return { rows, page: { next, more, total } };
  }

  return {
    meta,

    async query(body, ctx = {}) {
      const query = parsed(schemas.query, body, 'the query is invalid');
      const asked = source.query ?? notFound(`${name} serves no query`);
      if (isWhole(asked)) {
        const answer = await guarded(() => asked.run(ctx));
        const rows = asked.records(answer).map(rowFrom);
        const result = queryInMemory(rows, query, meta, registry, ctx);
        return { ...result, rows: result.rows.map((row) => trimmed(row, query.fields)) };
      }
      return queryPaged(query, asked, ctx);
    },

    async read(id, ctx = {}) {
      const read = source.read ?? notFound(`${name} serves no read`);
      const record = await guarded(() => read.run(id, ctx));
      return record === null ? notFound() : rowFrom(record);
    },

    async create(body, ctx = {}) {
      const create = source.create ?? notFound(`${name} serves no create`);
      const values = { ...parsed(schemas.create, body, 'the create is invalid').values };
      for (const [key, field] of Object.entries(create.fields)) {
        if (field?.default !== undefined && !(key in values)) {
          values[key] = field.default;
        }
      }
      const issues = (await create.check?.(values, ctx)) ?? [];
      if (issues.length > 0) {
        throw new ResourceError('invalid', 'the create is invalid', issues);
      }
      const parts = Object.entries(values).map(
        ([key, value]) => create.fields[key]?.to(value) ?? {},
      );
      const record = await guarded(() => create.run(Object.assign({}, ...parts) as Body, ctx));
      return rowFrom(record);
    },

    async update(id, body, ctx = {}) {
      const update = source.update ?? notFound(`${name} serves no update`);
      const patch = parsed(schemas.patch, body, 'the patch is invalid');
      const issues = (await update.check?.(id, patch.values, ctx)) ?? [];
      if (issues.length > 0) {
        throw new ResourceError('invalid', 'the patch is invalid', issues);
      }
      const parts = Object.entries(patch.values).map(
        ([key, value]) => update.fields[key]?.to(value) ?? {},
      );
      const version = update.version ? patch.version : undefined;
      const record = await guarded(() => {
        return update.run(id, Object.assign({}, ...parts) as Body, version, ctx);
      });
      return record === null ? notFound() : rowFrom(record);
    },

    async delete(id, version, ctx = {}) {
      const remove = source.delete ?? notFound(`${name} serves no delete`);
      const removed = await guarded(() => {
        return remove.run(id, remove.version ? version : undefined, ctx);
      });
      if (!removed) {
        notFound();
      }
    },
  };
}
