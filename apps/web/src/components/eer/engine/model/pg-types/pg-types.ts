// The type vocabulary. Types are STORED as SQL text ("varchar(255)",
// "integer[2][]") because that is what Postgres and drizzle both print — the
// diagram never invents a vocabulary of its own. There is no `custom` escape
// hatch: a name the catalogue doesn't know parses as `known: false`, which the
// picker renders as an invalid selection and which blocks export.

import { DESCRIPTORS, VARIANTS, type PgTypeDescriptor } from './descriptors';

export type { PgTypeDescriptor, PgTypeGroup, PgTypeParam } from './descriptors';

export const PG_TYPES: PgTypeDescriptor[] = [...DESCRIPTORS, ...VARIANTS];

const BY_SQL_NAME = new Map(PG_TYPES.map((t) => [t.sqlName, t]));

// Legacy and Postgres-shorthand spellings → the name drizzle prints.
export const TYPE_ALIASES = new Map<string, string>([
  ['int', 'integer'],
  ['int4', 'integer'],
  ['int2', 'smallint'],
  ['int8', 'bigint'],
  ['serial4', 'serial'],
  ['serial8', 'bigserial'],
  ['bool', 'boolean'],
  ['decimal', 'numeric'],
  ['float8', 'double precision'],
  ['float4', 'real'],
  ['timestamptz', 'timestamp with time zone'],
  ['timetz', 'time with time zone'],
  ['character varying', 'varchar'],
  ['character', 'char'],
]);

export function normalizeTypeName(base: string): string {
  return TYPE_ALIASES.get(base.trim().toLowerCase()) ?? base.trim();
}

export interface ArrayDimension {
  size: number | null;
}

export interface ParsedType {
  base: string;
  params: string[];
  arrays: ArrayDimension[];
  known: boolean;
}

const ARRAY_SUFFIX = /(\[\d*\])+$/;

export function parseType(s: string): ParsedType {
  let text = s.trim();

  // 1. peel array dimensions off the end: integer[2][] → [{size:2},{size:null}]
  const arrays: ArrayDimension[] = [];
  const suffix = text.match(ARRAY_SUFFIX);
  if (suffix) {
    text = text.slice(0, suffix.index).trim();
    for (const dim of suffix[0].matchAll(/\[(\d*)\]/g)) {
      arrays.push({ size: dim[1] ? Number(dim[1]) : null });
    }
  }

  // geometry(point) is a whole SQL name that happens to look parameterised —
  // check the full text against the catalogue before peeling "params" off it.
  if (BY_SQL_NAME.has(text)) return { base: text, params: [], arrays, known: true };

  // 2. peel parameters: numeric(10,2) → ['10','2']
  let params: string[] = [];
  const open = text.indexOf('(');
  if (open !== -1 && text.endsWith(')')) {
    params = text
      .slice(open + 1, -1)
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    text = text.slice(0, open).trim();
  }

  const base = normalizeTypeName(text);
  return { base, params, arrays, known: BY_SQL_NAME.has(base) };
}

export function formatType(base: string, params: string[], arrays: ArrayDimension[] = []): string {
  const kept = params.map((p) => p.trim()).filter((p) => p.length > 0);
  const head = kept.length ? `${base}(${kept.join(',')})` : base;
  const tail = arrays.map((a) => `[${a.size ?? ''}]`).join('');
  return head + tail;
}

export function descriptorFor(base: string): PgTypeDescriptor | undefined {
  return BY_SQL_NAME.get(normalizeTypeName(base));
}
