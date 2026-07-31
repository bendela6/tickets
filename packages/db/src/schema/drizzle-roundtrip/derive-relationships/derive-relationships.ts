// A COPY of the eer app's engine/model/derive-relationships/derive-relationships.ts,
// not a move — see drizzle-roundtrip/types/types.ts's header for why. Needed
// here only as a transitive dependency of load-model.ts and serialize-model.ts.
//
// Relationships ARE the foreign keys. One edge per FK constraint, with a stable
// id built from the owning entity and constraint, so renames never orphan an
// edge and nothing has to guess which edges were "derived" vs authored.
// Authored relationships whose endpoint pair has no backing FK constraint at
// all — regardless of their own `kind` — are kept verbatim. That includes an
// authored `kind:'fk'` relationship over a column with no `ref` (e.g. a
// polymorphic reference): it LOOKS like a plain fk edge, but no constraint
// exists to derive it from, so dropping it because kind==='fk' would silently
// erase the edge (and, via serialize-model, the file) on the very next load.
//
// A derived edge's own SHAPE (id, source/target/fields) always wins — but an
// authored relationship covering the exact same endpoint pair can still carry
// data the plain derived shape can't express: a label, a non-fk kind (e.g. a
// dashed 'nm'/'m2m' annotation over what is, physically, a single fk column),
// or an explicitly-declared cardinality. That authored data is folded onto the
// derived edge rather than discarded — see `enrichedDerived` below — so saving
// a model with hand-labelled fk edges doesn't zero out every label on the very
// next load.

import type { Cardinality, Entity, Model, Relationship } from '../types';

export const pairKey = (r: { source: string; sourceField: string; target: string; targetField: string }): string =>
  [`${r.source}.${r.sourceField}`, `${r.target}.${r.targetField}`].sort().join('|');

// Set equality, order-insensitive — shared with run-checks.ts's "every fk
// references a key" self-check (Postgres requires an fk's refColumns to be
// EXACTLY a pk or unique constraint's column set, no more/less, any order).
export const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

// A derived edge's id is always `rel:<target-entity-id>:<constraint-id>` (see
// deriveConstraintEdges below) — a shape no hand-authored id collides with in
// practice. That makes it a reliable signal for telling apart two very
// different reasons an "authored" relationship's pair might not be covered by
// any CURRENT derived edge:
//  - it's genuinely authored (a raw-file relationship, or user-typed id) that
//    never had a backing constraint — e.g. a polymorphic reference. That one
//    must be kept verbatim (see the module header comment).
//  - it's the residue of a PREVIOUS derivation round fed back in as "authored"
//    input by apply-model-edit's finalize() (every edit re-derives, using the
//    model's current `relationships` as the authored list) — and its backing
//    constraint/column was just edited away in THIS round. That one must be
//    dropped, or "relationships ARE the foreign keys" breaks: removing an fk
//    constraint (or renaming its column) would leave a phantom edge behind
//    forever instead of the edge disappearing along with its constraint.
// Exported so serialize-model can use the exact same test to recognize an
// actual derived (or derived-and-enriched) edge apart from an authored
// relationship that merely shares its endpoint pair (e.g. a second authored
// rel on a pair that already has a derived twin, kept verbatim per the
// `authored` filter below) — see serialize-model's `isFullyDerivable`.
export const looksDerived = (r: { id: string; target: string }): boolean => r.id.startsWith(`rel:${r.target}:`);

// 1-1 when each parent row can match at most one child row: the child's fk
// columns are its whole primary key, or are covered by a unique constraint.
function cardinalityOf(entity: Entity, columns: string[]): Cardinality {
  for (const c of entity.constraints) {
    if ((c.kind === 'pk' || c.kind === 'unique') && sameSet(c.columns, columns)) return '1-1';
  }
  return '1-n';
}

// One bare fk edge per FK constraint whose target table/columns actually
// resolve. This is the set of endpoint pairs a real constraint backs — the
// only pairs deriveRelationships can regenerate on the next load. Exported so
// serialize-model can tell "a bare-looking fk relationship that IS reproducible
// from a constraint" (safe to omit from the file) apart from "an authored
// fk-kind relationship that merely looks bare but has no constraint behind it
// at all" (must be written, or it's gone for good).
export function deriveConstraintEdges(model: Model): Relationship[] {
  const derived: Relationship[] = [];
  for (const e of model.entities) {
    const ownNames = new Set(e.columns.map((f) => f.name));
    for (const c of e.constraints) {
      if (c.kind !== 'fk') continue;
      const target = model.entityById.get(c.refTable);
      if (!target) continue;
      const names = new Set(target.columns.map((f) => f.name));
      if (!c.refColumns.length || !c.columns.length) continue;
      if (!c.refColumns.every((n) => names.has(n))) continue;
      if (!c.columns.every((n) => ownNames.has(n))) continue; // own column dangling — see load-model's matching warning
      derived.push({
        id: `rel:${e.id}:${c.id}`,
        source: c.refTable,
        sourceField: c.refColumns[0]!,
        target: e.id,
        targetField: c.columns[0]!,
        cardinality: cardinalityOf(e, c.columns),
        cardinalityInferred: true,
        kind: 'fk',
        label: null,
      });
    }
  }
  return derived;
}

export function deriveRelationships(model: Model): Relationship[] {
  const derived = deriveConstraintEdges(model);
  const derivedPairs = new Set(derived.map(pairKey));

  // Every authored relationship whose endpoints still resolve, keyed by its
  // unordered endpoint pair — regardless of its own kind, so an authored
  // kind:'fk' rel (carrying only a label) is just as eligible a donor as an
  // authored kind:'nm'/'m2m' one. If a second authored rel covers the same
  // pair, it is NOT a second donor (a derived edge can only carry one
  // label/kind/cardinality) — it is kept verbatim as its own relationship
  // instead (see `authored` below), so two hand-authored rels over one pair
  // both survive rather than the second silently vanishing.
  const resolvedAuthored = model.relationships.filter(
    (r) => model.entityById.has(r.source) && model.entityById.has(r.target),
  );
  const authoredByPair = new Map<string, Relationship>();
  // Pass 1: a relationship that IS the current derived-and-enriched edge
  // (id-shaped `rel:<target>:...`, fed back in as "authored" by finalize()'s
  // every-edit re-derivation) always wins the donor slot when present, no
  // matter where it lands in the array relative to some OTHER authored rel
  // sharing its pair. Without this, a kept-verbatim second rel — which
  // serialize-model writes BEFORE the enriched edge (see `authored` below,
  // returned first) — would get read back from the file ahead of it on the
  // very next load and steal the donor slot by array order alone, silently
  // swapping (and, past a second roundtrip, permanently losing) the original
  // donor's label/kind.
  for (const r of resolvedAuthored) {
    if (!looksDerived(r)) continue;
    const key = pairKey(r);
    if (!authoredByPair.has(key)) authoredByPair.set(key, r);
  }
  // Pass 2: any pair with no looksDerived candidate (the common case — a
  // fresh, never-yet-derived load) falls back to first-in-array, same as
  // before.
  for (const r of resolvedAuthored) {
    const key = pairKey(r);
    if (!authoredByPair.has(key)) authoredByPair.set(key, r);
  }

  const enrichedDerived = derived.map((d) => {
    const match = authoredByPair.get(pairKey(d));
    if (!match) return d;
    return {
      ...d,
      label: match.label ? match.label : d.label,
      kind: match.kind !== 'fk' ? match.kind : d.kind,
      ...(match.cardinalityInferred === false
        ? { cardinality: match.cardinality, cardinalityInferred: false }
        : {}),
    };
  });

  // Authored relationships kept verbatim — whatever their `kind`. This is two
  // groups:
  //  - those that don't cover any derived pair at all. Most of these are
  //    documentation edges (kind 'nm'/'m2m') with no backing fk constraint,
  //    but an authored `kind:'fk'` relationship belongs here too whenever no
  //    constraint backs it (e.g. a polymorphic reference column with no
  //    `ref`): there is no derived twin for it to be folded onto, so dropping
  //    it just because its kind reads 'fk' would silently delete the edge.
  //  - those that DO cover a derived pair but lost the donor slot to an
  //    earlier authored rel over the same pair (see `authoredByPair` above).
  //    A derived edge can only carry one folded-in label/kind/cardinality, so
  //    a second (or third) authored rel on the same pair isn't re-derivable
  //    from anything — it must be kept as its own relationship, or it's
  //    silently erased in memory and, via serialize-model, from the file.
  // Excluded from both, though: anything id-shaped like a derived edge for its
  // own target whose pair isn't covered any more — that's a previous round's
  // derived edge whose backing constraint just changed out from under it, not
  // authored data (see `looksDerived`).
  const authored = resolvedAuthored.filter((r) => {
    if (looksDerived(r)) return false;
    const key = pairKey(r);
    if (!derivedPairs.has(key)) return true;
    return authoredByPair.get(key) !== r; // donor already folded into enrichedDerived; a non-donor survives verbatim
  });
  return [...authored, ...enrichedDerived];
}
