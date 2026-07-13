// Model → raw JSON file shape. Inverse of load-model for everything the editor
// touches: meta, kinds, colours, groups+bounds, entities+positions+fields
// (+constraints+indexes), and relationships. Underscore-prefixed derived state
// is never serialized.
//
// Relationships ARE the foreign keys now (see derive-relationships.ts): a
// BARE `kind: 'fk'` relationship — no label, no non-fk kind, an inferred
// cardinality — is, by construction, reproduced byte-for-byte by
// deriveRelationships from the entity's `constraints` on the very next load,
// so it's never written to the file. But deriveRelationships also folds
// authored data (a label, a non-fk kind such as 'nm'/'m2m', an explicit
// cardinality) onto a derived edge when an authored relationship covers the
// same endpoint pair — and THAT data is not reproducible from the constraint
// alone, so any relationship carrying it must still be written, even when its
// `kind` reads 'fk'. Only a fully-bare derived fk edge is omitted.
//
// Bare shape alone isn't enough to prove that, though: an authored `kind:'fk'`
// relationship with no label over a column with no backing fk constraint at
// all (e.g. a polymorphic reference) looks IDENTICAL to a bare derived edge —
// but there is no constraint to regenerate it from. Omitting it would erase
// it permanently. So a relationship is only "fully derivable" when its
// endpoint pair is actually backed by a real fk constraint (see
// `deriveConstraintEdges`), not merely shaped like one.

import { deriveConstraintEdges, looksDerived, pairKey } from '../derive-relationships';
import type { Constraint, Model, Relationship, TableIndex } from '../types';

// Safe to omit entirely: a bare derived fk edge (no label, kind still 'fk', an
// inferred — not explicitly authored — cardinality) AND actually backed by a
// real fk constraint reproduces byte-for-byte from that constraint on the very
// next load. Anything else (a label, a non-fk kind, an explicitly-declared
// cardinality, or no backing constraint at all) is data the constraint alone
// can't regenerate, and must be written.
function isFullyDerivable(r: Relationship, constraintBackedPairs: ReadonlySet<string>): boolean {
  // `looksDerived` (same id-scheme test derive-relationships itself uses)
  // rules out a second authored relationship that merely shares its endpoint
  // pair with a derived edge (kept verbatim — see derive-relationships.ts —
  // because a derived edge can only fold in ONE donor's label/kind). Without
  // it, such a rel would look identical to the real derived edge by shape
  // alone whenever it's unlabelled/kind-fk/inferred, and get wrongly omitted
  // here — losing it (and the fact there were two edges on that pair) for good.
  return (
    looksDerived(r) &&
    r.kind === 'fk' &&
    !r.label &&
    r.cardinalityInferred &&
    constraintBackedPairs.has(pairKey(r))
  );
}

function serializeConstraint(c: Constraint): Record<string, unknown> {
  const base: Record<string, unknown> = { id: c.id, kind: c.kind, ...(c.name ? { name: c.name } : {}) };
  if (c.kind === 'check') return { ...base, expression: c.expression };
  if (c.kind === 'fk')
    return {
      ...base,
      columns: c.columns,
      refTable: c.refTable,
      refColumns: c.refColumns,
      ...(c.onDelete ? { onDelete: c.onDelete } : {}),
      ...(c.onUpdate ? { onUpdate: c.onUpdate } : {}),
    };
  return { ...base, columns: c.columns }; // 'pk' | 'unique'
}

function serializeIndex(ix: TableIndex): Record<string, unknown> {
  return { id: ix.id, name: ix.name, columns: ix.columns, unique: ix.unique };
}

export function serializeModel(model: Model, colors: ReadonlyMap<string, string>): Record<string, unknown> {
  const bounds = new Map(model._groupBounds.map((b) => [b.id, { x: b.x, y: b.y, w: b.w, h: b.h }]));
  const constraintBackedPairs = new Set(deriveConstraintEdges(model).map(pairKey));
  return {
    meta: { title: model.meta.title ?? '', description: model.meta.description ?? '' },
    view: { routing: model.view.routing },
    kinds: model.kinds.map((k) => ({ id: k.id, label: k.label, style: k.style })),
    colors: Object.fromEntries(colors),
    groups: model.groups.map((g) => ({
      id: g.id,
      label: g.label,
      order: g.order,
      ...(g.parent ? { parent: g.parent } : {}),
      ...(bounds.has(g.id) ? { bounds: bounds.get(g.id) } : {}),
    })),
    entities: model.entities.map((e) => ({
      id: e.id,
      label: e.label,
      group: e.group,
      ...(e.description ? { description: e.description } : {}),
      x: e.x,
      y: e.y,
      fields: e.fields.map((f) => ({
        name: f.name,
        type: f.type,
        ...(f.role ? { role: f.role } : {}),
        ...(f.ref ? { ref: f.ref, refField: f.refField ?? 'id' } : {}),
        ...(f.title ? { title: f.title } : {}),
        ...(f.description ? { description: f.description } : {}),
        ...(f.nullable === false ? { nullable: false } : {}),
        ...(f.default != null ? { default: f.default } : {}),
      })),
      constraints: e.constraints.map(serializeConstraint),
      indexes: e.indexes.map(serializeIndex),
    })),
    // A bare derived fk edge regenerates from its constraint on load (see the
    // header comment) and is omitted; anything carrying authored data a
    // constraint can't reproduce (label / non-fk kind / explicit cardinality)
    // is written, even when its kind still reads 'fk'.
    relationships: model.relationships
      .filter((r) => !isFullyDerivable(r, constraintBackedPairs))
      .map((r) => ({
        id: r.id,
        source: r.source,
        sourceField: r.sourceField,
        target: r.target,
        targetField: r.targetField,
        ...(r.kind ? { kind: r.kind } : {}),
        ...(r.label ? { label: r.label } : {}),
        // Only write cardinality when the file explicitly declared it
        // (cardinalityInferred === false). Writing an INFERRED cardinality
        // unconditionally froze it forever: on reload, an explicit key makes
        // load-model set cardinalityInferred: false, and derive-relationships
        // then pins that stale value over the freshly re-derived one — a
        // single Save permanently disables re-derivation for that edge (see
        // the module header / reviewer finding).
        ...(r.cardinalityInferred === false ? { cardinality: r.cardinality } : {}),
      })),
  };
}
