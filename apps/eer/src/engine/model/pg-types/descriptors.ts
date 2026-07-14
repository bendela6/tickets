// One descriptor per drizzle pg-core builder. The NAMES come from drizzle (a
// built column's getSQLType()); the grouping, parameter grammar and display
// shorthand are ours — getSQLType() can't tell us that varchar takes a length
// while text doesn't (an unparameterised `bit` even reports "bit(undefined)").
// pg-types.test.ts asserts every builder in drizzle's registry appears here, so
// a drizzle upgrade that adds a type fails the suite instead of silently
// missing from the picker.

export type PgTypeGroup =
  | 'numeric' | 'text' | 'temporal' | 'boolean' | 'uuid'
  | 'json' | 'network' | 'geometric' | 'vector';

export interface PgTypeParam {
  name: string;
  kind: 'int' | 'text';
}

export interface PgTypeDescriptor {
  builder: string; // the getPgColumnBuilders() key
  sqlName: string; // what Postgres/drizzle print
  displayName: string; // what the picker shows (shorthand allowed)
  group: PgTypeGroup;
  params: PgTypeParam[];
}

const P = {
  length: { name: 'n', kind: 'int' } as PgTypeParam,
  precision: { name: 'p', kind: 'int' } as PgTypeParam,
  scale: { name: 's', kind: 'int' } as PgTypeParam,
  dimensions: { name: 'd', kind: 'int' } as PgTypeParam,
};

export const DESCRIPTORS: PgTypeDescriptor[] = [
  { builder: 'smallint', sqlName: 'smallint', displayName: 'smallint', group: 'numeric', params: [] },
  { builder: 'integer', sqlName: 'integer', displayName: 'integer', group: 'numeric', params: [] },
  { builder: 'bigint', sqlName: 'bigint', displayName: 'bigint', group: 'numeric', params: [] },
  { builder: 'smallserial', sqlName: 'smallserial', displayName: 'smallserial', group: 'numeric', params: [] },
  { builder: 'serial', sqlName: 'serial', displayName: 'serial', group: 'numeric', params: [] },
  { builder: 'bigserial', sqlName: 'bigserial', displayName: 'bigserial', group: 'numeric', params: [] },
  { builder: 'numeric', sqlName: 'numeric', displayName: 'numeric', group: 'numeric', params: [P.precision, P.scale] },
  { builder: 'real', sqlName: 'real', displayName: 'real', group: 'numeric', params: [] },
  { builder: 'doublePrecision', sqlName: 'double precision', displayName: 'double precision', group: 'numeric', params: [] },

  { builder: 'text', sqlName: 'text', displayName: 'text', group: 'text', params: [] },
  { builder: 'varchar', sqlName: 'varchar', displayName: 'varchar', group: 'text', params: [P.length] },
  { builder: 'char', sqlName: 'char', displayName: 'char', group: 'text', params: [P.length] },

  { builder: 'boolean', sqlName: 'boolean', displayName: 'boolean', group: 'boolean', params: [] },
  { builder: 'uuid', sqlName: 'uuid', displayName: 'uuid', group: 'uuid', params: [] },

  { builder: 'date', sqlName: 'date', displayName: 'date', group: 'temporal', params: [] },
  { builder: 'time', sqlName: 'time', displayName: 'time', group: 'temporal', params: [P.precision] },
  { builder: 'timestamp', sqlName: 'timestamp', displayName: 'timestamp', group: 'temporal', params: [P.precision] },
  { builder: 'interval', sqlName: 'interval', displayName: 'interval', group: 'temporal', params: [] },

  { builder: 'json', sqlName: 'json', displayName: 'json', group: 'json', params: [] },
  { builder: 'jsonb', sqlName: 'jsonb', displayName: 'jsonb', group: 'json', params: [] },

  { builder: 'inet', sqlName: 'inet', displayName: 'inet', group: 'network', params: [] },
  { builder: 'cidr', sqlName: 'cidr', displayName: 'cidr', group: 'network', params: [] },
  { builder: 'macaddr', sqlName: 'macaddr', displayName: 'macaddr', group: 'network', params: [] },
  { builder: 'macaddr8', sqlName: 'macaddr8', displayName: 'macaddr8', group: 'network', params: [] },

  { builder: 'point', sqlName: 'point', displayName: 'point', group: 'geometric', params: [] },
  { builder: 'line', sqlName: 'line', displayName: 'line', group: 'geometric', params: [] },
  { builder: 'geometry', sqlName: 'geometry(point)', displayName: 'geometry(point)', group: 'geometric', params: [] },

  { builder: 'bit', sqlName: 'bit', displayName: 'bit', group: 'vector', params: [P.length] },
  { builder: 'vector', sqlName: 'vector', displayName: 'vector', group: 'vector', params: [P.dimensions] },
  { builder: 'halfvec', sqlName: 'halfvec', displayName: 'halfvec', group: 'vector', params: [P.dimensions] },
  { builder: 'sparsevec', sqlName: 'sparsevec', displayName: 'sparsevec', group: 'vector', params: [P.dimensions] },
];

// Variants a builder reaches through options rather than a distinct export.
// They are real SQL types with their own names, so the picker lists them, but
// they map back to the SAME builder plus an option bag on export (Task 6).
export const VARIANTS: PgTypeDescriptor[] = [
  {
    builder: 'timestamp', sqlName: 'timestamp with time zone', displayName: 'timestamptz',
    group: 'temporal', params: [P.precision],
  },
  {
    builder: 'time', sqlName: 'time with time zone', displayName: 'timetz',
    group: 'temporal', params: [P.precision],
  },
];
