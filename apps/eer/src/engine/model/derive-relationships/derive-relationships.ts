// Relationships ARE the foreign keys. One edge per FK constraint, with a stable
// id built from the owning entity and constraint, so renames never orphan an
// edge and nothing has to guess which edges were "derived" vs authored.
// Authored non-fk relationships (n-m documentation edges) are kept verbatim.
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

const pairKey = (r: { source: string; sourceField: string; target: string; targetField: string }): string =>
  [`${r.source}.${r.sourceField}`, `${r.target}.${r.targetField}`].sort().join('|');

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

// 1-1 when each parent row can match at most one child row: the child's fk
// columns are its whole primary key, or are covered by a unique constraint.
function cardinalityOf(entity: Entity, columns: string[]): Cardinality {
  for (const c of entity.constraints) {
    if ((c.kind === 'pk' || c.kind === 'unique') && sameSet(c.columns, columns)) return '1-1';
  }
  return '1-n';
}

export function deriveRelationships(model: Model): Relationship[] {
  const derived: Relationship[] = [];
  for (const e of model.entities) {
    for (const c of e.constraints) {
      if (c.kind !== 'fk') continue;
      const target = model.entityById.get(c.refTable);
      if (!target) continue;
      const names = new Set(target.fields.map((f) => f.name));
      if (!c.refColumns.length || !c.columns.length) continue;
      if (!c.refColumns.every((n) => names.has(n))) continue;
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

  const derivedPairs = new Set(derived.map(pairKey));

  // Every authored relationship whose endpoints still resolve, keyed by its
  // unordered endpoint pair — regardless of its own kind, so an authored
  // kind:'fk' rel (carrying only a label) is just as eligible a donor as an
  // authored kind:'nm'/'m2m' one. First match wins; real models don't author
  // two relationships over the same pair, and if they did, "some" data
  // surviving beats an arbitrary tie-break rule nobody could predict.
  const resolvedAuthored = model.relationships.filter(
    (r) => model.entityById.has(r.source) && model.entityById.has(r.target),
  );
  const authoredByPair = new Map<string, Relationship>();
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

  // Authored non-fk relationships that don't cover any derived pair are kept
  // verbatim, first (unchanged from before) — a documentation edge with no
  // backing fk constraint at all.
  const authored = resolvedAuthored.filter((r) => r.kind !== 'fk' && !derivedPairs.has(pairKey(r)));
  return [...authored, ...enrichedDerived];
}
