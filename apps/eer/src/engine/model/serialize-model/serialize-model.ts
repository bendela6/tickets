// Model → raw JSON file shape. Inverse of load-model for everything the editor
// touches: meta, kinds, colours, groups+bounds, entities+positions+fields
// (+constraints+indexes), and relationships. Underscore-prefixed derived state
// is never serialized.
//
// Relationships ARE the foreign keys now (see derive-relationships.ts): every
// `kind: 'fk'` relationship is, by construction, reproduced byte-for-byte by
// deriveRelationships from the entity's `constraints` on the very next load —
// there is no such thing as a hand-authored kind:'fk' rel any more, so we never
// write one to the file. Only non-fk relationships (documentation edges such
// as `kind: 'nm'`) are authored data and survive serialize -> load verbatim.

import type { Constraint, Model, TableIndex } from '../types';

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
    // kind:'fk' relationships regenerate from constraints on load (see the
    // header comment) — only authored non-fk relationships are written.
    relationships: model.relationships
      .filter((r) => r.kind !== 'fk')
      .map((r) => ({
        id: r.id,
        source: r.source,
        sourceField: r.sourceField,
        target: r.target,
        targetField: r.targetField,
        ...(r.kind ? { kind: r.kind } : {}),
        ...(r.label ? { label: r.label } : {}),
        cardinality: r.cardinality,
      })),
  };
}
