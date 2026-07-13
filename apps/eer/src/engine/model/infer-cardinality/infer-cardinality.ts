// Cardinality of a relationship: taken verbatim when the JSON provides a valid
// one, otherwise inferred from the endpoints' derived roles. `fallback` marks
// the truly ambiguous cases the loader should warn about.
//
// The endpoints are described by `EndpointRole` — the same `{ pk, fk }` shape
// `columnRoles` (see ../column-roles) derives from an entity's CONSTRAINTS.
// That works identically whether the file authors keys the old way (per-field
// `role`/`ref`, which load-model synthesizes into constraints) or the new way
// (an explicit `constraints` array) — constraints are the one signal every
// model has, so cardinality inference never needs to know which shape the
// file was authored in.

import type { Cardinality } from '../types';

const CARDINALITIES: Cardinality[] = ['1-1', '1-n', 'n-1', 'n-m'];

export interface EndpointRole {
  pk: boolean;
  fk: boolean;
}

export interface InferredCardinality {
  value: Cardinality;
  inferred: boolean;
  fallback?: boolean;
}

// Collapse an endpoint's (possibly both-true) booleans to the single tag the
// decision table below reasons about. `pk` wins over `fk` when a column is
// both — e.g. a shared-primary-key reference (outbox.event_id: pk AND fk) is
// the identifying case, not a plain fk-to-fk one.
function tag(r: EndpointRole): 'pk' | 'fk' | null {
  if (r.pk) return 'pk';
  if (r.fk) return 'fk';
  return null;
}

export function inferCardinality(
  rel: { cardinality?: unknown },
  src: EndpointRole,
  tgt: EndpointRole,
): InferredCardinality {
  if (typeof rel.cardinality === 'string' && CARDINALITIES.includes(rel.cardinality as Cardinality)) {
    return { value: rel.cardinality as Cardinality, inferred: false };
  }
  if (rel.cardinality) return { value: '1-n', inferred: false }; // present but invalid; caller warns

  const srcTag = tag(src);
  const tgtTag = tag(tgt);

  if (srcTag === 'pk' && tgtTag === 'fk') return { value: '1-n', inferred: true };
  if (srcTag === 'fk' && tgtTag === 'pk') return { value: 'n-1', inferred: true };
  if (srcTag === 'fk' && tgtTag === 'fk') return { value: 'n-m', inferred: true };
  // Identifying relationship: the child's primary key IS the reference (shared PK) — 1-1.
  if (srcTag === 'pk' && tgtTag === 'pk') return { value: '1-1', inferred: true };
  // Exactly one keyed endpoint: the keyed side is the "one", the untagged side the "many".
  if (srcTag === 'pk' && !tgtTag) return { value: '1-n', inferred: true };
  if (!srcTag && tgtTag === 'pk') return { value: 'n-1', inferred: true };
  return { value: '1-n', inferred: true, fallback: true };
}

export { CARDINALITIES };
