import * as v from 'valibot';
import {
  issuesOf,
  metaOf,
  type FieldMeta,
  type FieldQuery,
  type FieldWrite,
  type KindSpec,
  type Registry,
  type ResourceMeta,
  type Serves,
} from '@bh/resource';
import type { FieldDefinition, ResourceDefinition } from '../types/definition';
import type { PagedQuery, WholeQuery } from '../types/query';
import type { Source } from '../types/source';

// The metadata a resource answers at GET /meta, made from what its source
// declares and the kinds, never written by hand: the kind is the ceiling,
// the source says what it can do, and the metadata is what both allow. A
// declaration that claims more than its kind allows, names a field there
// isn't, or writes a templated one is a mistake, reported when the server
// starts, never dropped unseen.

// bh's two operators that compare one value with one value: a field holding
// a list isn't filtered by them.
const ONE_TO_ONE = new Set(['equals', 'notEquals']);

/** Whether a source answers every row at once, so bh serves its queries in memory. */
export function isWhole<R, Request, Answer>(
  query: PagedQuery<R, Request, Answer> | WholeQuery<R, Answer>,
): query is WholeQuery<R, Answer> {
  return query.paging === 'none';
}

/** What a query may do with a field bh serves in memory: everything its kind allows. */
function inMemory(field: FieldDefinition, kind: KindSpec): FieldQuery {
  const many = field.type.many === true;
  // isMe means the person viewing: a ref to anything but people leaves it out.
  const people = field.type.kind !== 'ref' || field.type.settings?.['of'] === 'users';
  return {
    filter: kind.operators.filter((op) => {
      return !(many && ONE_TO_ONE.has(op)) && (op !== 'isMe' || people);
    }),
    sort: kind.sort && !many && kind.compare !== undefined,
    group: kind.group,
    search: kind.search,
  };
}

type Report = (message: string) => void;

/** What a query may do with a field its source serves: what it declares, checked against its kind. */
function declared<R, Request, Answer>(
  field: FieldDefinition,
  kind: KindSpec,
  query: PagedQuery<R, Request, Answer>,
  registry: Registry,
  report: Report,
): FieldQuery {
  const { key } = field;
  const many = field.type.many === true;
  // Each mistake is reported here, once, and kept out of the metadata, so
  // metaOf doesn't report it again.
  const filter = Object.keys(query.filter?.fields[key] ?? {}).filter((op) => {
    const at = `query.filter.fields.${key}.${op}`;
    if (!registry.operators.has(op)) {
      report(`${at}: no operator "${op}"`);
    } else if (!kind.operators.includes(op)) {
      report(`${at}: the kind "${kind.name}" can't be filtered by "${op}"`);
    } else if (many && ONE_TO_ONE.has(op)) {
      report(`${at}: a field holding a list isn't filtered by "${op}"`);
    } else {
      return true;
    }
    return false;
  });
  let sort = query.sort?.fields[key] !== undefined;
  if (sort && !kind.sort) {
    report(`query.sort.fields.${key}: the kind "${kind.name}" can't be sorted`);
    sort = false;
  } else if (sort && many) {
    report(`query.sort.fields.${key}: a field holding a list can't be sorted`);
    sort = false;
  }
  let group = query.group?.fields.includes(key) === true;
  if (group && !kind.group) {
    report(`query.group.fields.${key}: the kind "${kind.name}" can't be grouped`);
    group = false;
  }
  let search = query.search?.fields.includes(key) === true;
  if (search && !kind.search) {
    report(`query.search.fields.${key}: the kind "${kind.name}" can't be searched`);
    search = false;
  }
  return { filter, sort, group, search };
}

/** What a write may do with a field: what the source's create and update declare. */
function written<R, Request, Answer, Body>(
  field: FieldDefinition,
  source: Source<R, Request, Answer, Body>,
  report: Report,
): FieldWrite {
  const create = source.create?.fields[field.key];
  const update = source.update?.fields[field.key];
  if ((create ?? update) && field.template !== undefined) {
    report(
      `${create ? 'create' : 'update'}.fields.${field.key}: a templated field is never written`,
    );
  }
  const fallback = create?.default === undefined ? {} : { default: create.default };
  return {
    create: create !== undefined,
    update: update !== undefined,
    required: create?.required === true || update?.required === true,
    ...fallback,
  };
}

/** What the resource serves beyond its fields, as its source declares. */
function servesOf<R, Request, Answer, Body>(
  source: Source<R, Request, Answer, Body>,
  report: Report,
): Serves {
  const writes = {
    read: source.read !== undefined,
    create: source.create !== undefined,
    update: source.update !== undefined,
    delete: source.delete !== undefined,
  };
  const { query } = source;
  if (!query || isWhole(query)) {
    // In memory, bh joins, sorts and pages as the contract says, whatever the source.
    return {
      ...writes,
      filter: { any: true, not: true },
      sort: { max: 10 },
      page: { numbered: 'any', cursor: true, total: true, max: 500 },
    };
  }
  const { paging } = query;
  if (paging.offset && paging.page) {
    report('query.paging: a source pages by offset or by page number, not both');
  }
  if (!paging.offset && !paging.page && !paging.cursor) {
    report('query.paging: a source pages by offset, by page number or by cursor');
  }
  return {
    ...writes,
    filter: { any: query.filter?.any !== undefined, not: query.filter?.not !== undefined },
    sort: { max: query.sort?.max ?? 1 },
    page: {
      numbered: paging.offset ? 'any' : paging.page ? 'pages' : 'none',
      cursor: paging.cursor !== undefined,
      total: query.total !== undefined,
      max: paging.max,
    },
  };
}

/** The keys a map names that aren't fields: a declaration naming a field there isn't. */
function strangers(keys: Iterable<string>, fields: readonly FieldDefinition[]): string[] {
  return [...keys].filter((key) => !fields.some((field) => field.key === key.split('.')[0]));
}

/**
 * The metadata of a resource its source serves: each field's query and
 * write as the source declares them (everything its kind allows, for a
 * source bh serves in memory), and what the resource serves. Throws, listing
 * every mistake, on a declaration its kinds or fields don't allow.
 */
export function metaFrom<R, Request, Answer, Body>(
  definition: ResourceDefinition,
  source: Source<R, Request, Answer, Body>,
  registry: Registry,
): ResourceMeta {
  const problems: string[] = [];
  const report: Report = (message) => {
    problems.push(message);
  };
  const { fields } = definition;
  const { query } = source;
  if (!query) {
    report('query: a source answers a query, or it serves no rows');
  }

  for (const key of strangers(Object.keys(source.row), fields)) {
    report(`row.${key}: no field "${key}"`);
  }
  for (const field of fields) {
    if (!(field.key in source.row)) {
      report(`row: the source reads no "${field.key}"; a field it can't read isn't the resource's`);
    }
  }
  if (query && !isWhole(query)) {
    const named = [
      ...Object.keys(query.filter?.fields ?? {}),
      ...Object.keys(query.sort?.fields ?? {}),
      ...(query.search?.fields ?? []),
      ...(query.group?.fields ?? []),
    ];
    for (const key of strangers(named, fields)) {
      report(`query: no field "${key}"`);
    }
  }
  for (const [name, write] of [
    ['create', source.create],
    ['update', source.update],
  ] as const) {
    for (const key of strangers(Object.keys(write?.fields ?? {}), fields)) {
      report(`${name}.fields.${key}: no field "${key}"`);
    }
  }

  const versioned = definition.roles.versionField !== undefined;
  for (const [name, write] of [
    ['update', source.update],
    ['delete', source.delete],
  ] as const) {
    if (write && versioned && write.version !== true) {
      report(`${name}: the resource names a version field, so its ${name} checks the version`);
    } else if (write?.version === true && !versioned) {
      report(`${name}: it checks a version, but the resource names no roles.versionField`);
    }
  }

  const metaFields: FieldMeta[] = fields.map((field) => {
    const kind = registry.kinds.has(field.type.kind)
      ? registry.kinds.get(field.type.kind)
      : undefined;
    const none: FieldQuery = { filter: [], sort: false, group: false, search: false };
    const fieldQuery =
      !kind || !query
        ? none
        : isWhole(query)
          ? inMemory(field, kind)
          : declared(field, kind, query, registry, report);
    return { ...field, query: fieldQuery, write: written(field, source, report) };
  });

  const meta: ResourceMeta = {
    resource: definition.resource,
    label: definition.label,
    roles: definition.roles,
    fields: metaFields,
    sort: [...definition.sort],
    actions: [],
    serves: servesOf(source, report),
  };
  const checked = v.safeParse(metaOf(registry), meta);
  if (!checked.success) {
    for (const issue of issuesOf(checked.issues)) {
      report(`meta.${issue.path.join('.')}: ${issue.message}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `The source can't serve "${definition.resource}":\n${problems.map((each) => `  - ${each}`).join('\n')}`,
    );
  }
  return meta;
}
