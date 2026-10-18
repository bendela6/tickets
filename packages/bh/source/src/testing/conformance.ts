import {
  createRegistry,
  matchesFilter,
  type Condition,
  type FieldMeta,
  type Id,
  type Json,
  type Query,
  type Registry,
  type Row,
  type Scalar,
} from '@bh/resource';
import { rowOrder } from '../memory/order';
import type { ServedResource } from '../serve/serve';
import type { Context } from '../types/context';
import type { Operand } from '../types/translation';

// The fourth point of validation, for an adapter's tests: a source does what
// it declares. Over the rows a resource holds, each operator a field allows
// answers the rows matchesFilter keeps, and each sort the order each kind's
// rule gives; whatever differs comes back, so a test asserts there's none.
// It takes the resource as served, so it runs against the real source: a
// database, or an API's double.

/** What a source answered otherwise than the contract says. */
export interface Mismatch {
  /** 'status in ["todo"]', 'updatedAt desc'. */
  asked: string;
  /** The ids it should have answered and didn't. */
  missing: Id[];
  /** The ids it answered and shouldn't have. */
  extra: Id[];
  /** For a sort: the order it should have answered, and the one it did. */
  order?: { expected: Id[]; answered: Id[] };
}

export interface ConformanceOptions {
  /** The kinds and operators it was served with; bh's alone when absent. */
  registry?: Registry;
  /** Who is asking, for `isMe`: left out without a viewer. */
  ctx?: Context;
  /** Whether each sort is checked too; true when absent. */
  sort?: boolean;
}

/** Every row a query keeps, page by page, as the resource serves its pages. */
async function everyRow(resource: ServedResource, query: Query, ctx: Context): Promise<Row[]> {
  const { page } = resource.meta.serves;
  const rows: Row[] = [];
  let cursor: string | null = null;
  for (let turn = 0; turn < 1000; turn += 1) {
    // Numbered pages by whole pages, as every source that numbers them takes; else after the cursor.
    const paged: Query['page'] =
      page.numbered !== 'none'
        ? { skip: turn * page.max, take: page.max }
        : cursor === null
          ? { take: page.max }
          : { cursor, take: page.max };
    const answer = await resource.query({ ...query, page: paged }, ctx);
    rows.push(...answer.rows);
    cursor = answer.page.next;
    if (!answer.page.more || (page.numbered === 'none' && cursor === null)) {
      return rows;
    }
  }
  throw new Error('a query that never ends: more than 1000 pages');
}

/** The scalar values a field holds across the rows, each once, in their first order. */
function valuesOf(rows: readonly Row[], key: string): Scalar[] {
  const seen = new Map<string, Scalar>();
  for (const row of rows) {
    const value: Json = row[key] ?? null;
    for (const each of Array.isArray(value) ? value : [value]) {
      if (each !== null && typeof each !== 'object' && !seen.has(JSON.stringify(each))) {
        seen.set(JSON.stringify(each), each);
      }
    }
  }
  return [...seen.values()];
}

/** The operands to try an operator with, from the values the rows hold; [] when none fit. */
function operandsOf(
  op: string,
  field: FieldMeta,
  rows: readonly Row[],
  registry: Registry,
): Operand[] {
  const values = valuesOf(rows, field.key);
  const [first, second] = values;
  const kind = registry.kinds.has(field.type.kind)
    ? registry.kinds.get(field.type.kind)
    : undefined;
  switch (op) {
    case 'empty':
    case 'notEmpty':
    case 'isMe':
      return [undefined];
    case 'inLast':
    case 'notInLast':
      return [7, 3650];
    case 'equals':
    case 'notEquals':
      return first === undefined ? [] : [first];
    case 'in':
    case 'notIn':
      return first === undefined ? [] : [second === undefined ? [first] : [first, second]];
    case 'contains': {
      const text = values.find(
        (each): each is string => typeof each === 'string' && each.length > 0,
      );
      return text === undefined ? [] : [text.slice(text.length > 3 ? 1 : 0, 4).toUpperCase()];
    }
    case 'startsWith': {
      const text = values.find(
        (each): each is string => typeof each === 'string' && each.length > 0,
      );
      return text === undefined ? [] : [text.slice(0, 2).toUpperCase()];
    }
    default: {
      // A range: the middle value, by the kind's order.
      const compare = kind?.compare;
      const sorted = compare
        ? [...values].sort((a, b) => compare(a, b, field.type.settings))
        : values;
      const middle = sorted[Math.floor(sorted.length / 2)];
      return middle === undefined ? [] : [middle];
    }
  }
}

/** The ids of rows, as a set's text. */
function idsOf(rows: readonly Row[], idField: string): Id[] {
  return rows.map((row) => row[idField] as Id);
}

/**
 * What a served resource answers otherwise than the contract says, over the
 * rows it holds: each operator each field allows, tried with values the rows
 * hold, against matchesFilter; and each sort against each kind's order.
 * [] when it answers as it should.
 */
export async function conformance(
  resource: ServedResource,
  options: ConformanceOptions = {},
): Promise<Mismatch[]> {
  const registry = options.registry ?? createRegistry();
  const ctx = options.ctx ?? {};
  const { meta } = resource;
  const id = meta.roles.idField;
  const all = await everyRow(resource, {}, ctx);
  const mismatches: Mismatch[] = [];

  for (const field of meta.fields) {
    for (const op of field.query.filter) {
      if (op === 'isMe' && ctx.viewer === undefined) {
        continue;
      }
      for (const value of operandsOf(op, field, all, registry)) {
        const condition: Condition = {
          field: field.key,
          op,
          ...(value === undefined ? {} : { value }),
        };
        const expected = new Set(
          idsOf(
            all.filter((row) => matchesFilter(condition, row, meta, registry, ctx.viewer)),
            id,
          ),
        );
        const answered = new Set(idsOf(await everyRow(resource, { filter: condition }, ctx), id));
        const missing = [...expected].filter((each) => !answered.has(each));
        const extra = [...answered].filter((each) => !expected.has(each));
        if (missing.length > 0 || extra.length > 0) {
          const said = value === undefined ? '' : ` ${JSON.stringify(value)}`;
          mismatches.push({ asked: `${field.key} ${op}${said}`, missing, extra });
        }
      }
    }
    if (options.sort !== false && field.query.sort) {
      for (const dir of ['asc', 'desc'] as const) {
        const sort = [{ field: field.key, dir }];
        const expected = idsOf([...all].sort(rowOrder(sort, meta, registry)), id);
        const answered = idsOf(await everyRow(resource, { sort }, ctx), id);
        if (JSON.stringify(expected) !== JSON.stringify(answered)) {
          mismatches.push({
            asked: `${field.key} ${dir}`,
            missing: [],
            extra: [],
            order: { expected, answered },
          });
        }
      }
    }
  }
  return mismatches;
}
