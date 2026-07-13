// Cardinality of a relationship: taken verbatim when the JSON provides a valid
// one, otherwise inferred from the endpoint roles. `fallback` marks the truly
// ambiguous cases the loader should warn about.
//
// `Role` here is NOT the removed `Field.role` — the Column type carries no
// role at all any more (see types.ts / column-roles.ts, which derive PK/FK
// badges from constraints instead). This is purely load-model's own legacy
// concept: the raw JSON's per-field `role` key, read directly off the file
// (never stored on a Column) and passed in here just to infer an unauthored
// relationship's cardinality the same way the old loader did.

import type { Cardinality } from '../types';

export type Role = 'pk' | 'fk' | null;

const CARDINALITIES: Cardinality[] = ['1-1', '1-n', 'n-1', 'n-m'];

export interface InferredCardinality {
  value: Cardinality;
  inferred: boolean;
  fallback?: boolean;
}

export function inferCardinality(rel: { cardinality?: unknown }, srcRole: Role, tgtRole: Role): InferredCardinality {
  if (typeof rel.cardinality === 'string' && CARDINALITIES.includes(rel.cardinality as Cardinality)) {
    return { value: rel.cardinality as Cardinality, inferred: false };
  }
  if (rel.cardinality) return { value: '1-n', inferred: false }; // present but invalid; caller warns
  if (srcRole === 'pk' && tgtRole === 'fk') return { value: '1-n', inferred: true };
  if (srcRole === 'fk' && tgtRole === 'pk') return { value: 'n-1', inferred: true };
  if (srcRole === 'fk' && tgtRole === 'fk') return { value: 'n-m', inferred: true };
  // Identifying relationship: the child's primary key IS the reference (shared PK) — 1-1.
  if (srcRole === 'pk' && tgtRole === 'pk') return { value: '1-1', inferred: true };
  // Exactly one keyed endpoint: the keyed side is the "one", the untagged side the "many".
  if (srcRole === 'pk' && !tgtRole) return { value: '1-n', inferred: true };
  if (!srcRole && tgtRole === 'pk') return { value: 'n-1', inferred: true };
  return { value: '1-n', inferred: true, fallback: true };
}

export { CARDINALITIES };
