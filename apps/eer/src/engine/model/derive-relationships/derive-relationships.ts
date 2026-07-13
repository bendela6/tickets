// Relationships ARE the foreign keys. One edge per FK constraint, with a stable
// id built from the owning entity and constraint, so renames never orphan an
// edge and nothing has to guess which edges were "derived" vs authored.
// Authored non-fk relationships (n-m documentation edges) are kept verbatim.

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
  const authored = model.relationships.filter(
    (r) =>
      r.kind !== 'fk' &&
      model.entityById.has(r.source) &&
      model.entityById.has(r.target) &&
      !derivedPairs.has(pairKey(r)),
  );
  return [...authored, ...derived];
}
