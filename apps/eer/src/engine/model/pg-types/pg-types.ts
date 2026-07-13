// The Postgres type catalogue the editor's type picker offers, plus the string
// <-> (base, params) codec. Types are STORED as plain strings ("varchar(255)"),
// so hand-written files and custom types (enums, domains, citext) keep working —
// they simply parse as `custom` and render in the picker's free-text escape hatch.

export type PgTypeGroup = 'numeric' | 'text' | 'temporal' | 'boolean' | 'uuid' | 'json' | 'binary';

export interface PgType {
  name: string;
  group: PgTypeGroup;
  params: 0 | 1 | 2; // varchar(n) = 1, numeric(p,s) = 2
}

export const PG_TYPES: PgType[] = [
  { name: 'smallint', group: 'numeric', params: 0 },
  { name: 'int', group: 'numeric', params: 0 },
  { name: 'bigint', group: 'numeric', params: 0 },
  { name: 'serial', group: 'numeric', params: 0 },
  { name: 'bigserial', group: 'numeric', params: 0 },
  { name: 'numeric', group: 'numeric', params: 2 },
  { name: 'real', group: 'numeric', params: 0 },
  { name: 'double precision', group: 'numeric', params: 0 },
  { name: 'text', group: 'text', params: 0 },
  { name: 'varchar', group: 'text', params: 1 },
  { name: 'char', group: 'text', params: 1 },
  { name: 'boolean', group: 'boolean', params: 0 },
  { name: 'timestamptz', group: 'temporal', params: 0 },
  { name: 'timestamp', group: 'temporal', params: 0 },
  { name: 'date', group: 'temporal', params: 0 },
  { name: 'time', group: 'temporal', params: 0 },
  { name: 'interval', group: 'temporal', params: 0 },
  { name: 'uuid', group: 'uuid', params: 0 },
  { name: 'json', group: 'json', params: 0 },
  { name: 'jsonb', group: 'json', params: 0 },
  { name: 'bytea', group: 'binary', params: 0 },
];

const BY_NAME = new Map(PG_TYPES.map((t) => [t.name, t]));

export interface ParsedType {
  base: string;
  params: string[];
  custom: boolean; // base is not in the catalogue — keep the string verbatim
}

export function parseType(s: string): ParsedType {
  const text = s.trim();
  const open = text.indexOf('(');
  if (open === -1 || !text.endsWith(')')) {
    return { base: text, params: [], custom: !BY_NAME.has(text) };
  }
  const base = text.slice(0, open).trim();
  const params = text
    .slice(open + 1, -1)
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return { base, params, custom: !BY_NAME.has(base) };
}

export function formatType(base: string, params: string[]): string {
  const kept = params.map((p) => p.trim()).filter((p) => p.length > 0);
  return kept.length ? `${base}(${kept.join(',')})` : base;
}
