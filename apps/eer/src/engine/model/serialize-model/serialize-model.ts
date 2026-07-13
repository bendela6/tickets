// Model → raw JSON file shape. Inverse of load-model for everything the editor
// touches: meta, kinds, colours, groups+bounds, entities+positions+fields, and
// relationships. Underscore-prefixed derived state is never serialized. A
// relationship is omitted ONLY when load-model is guaranteed to reconstruct it
// byte-for-byte: kind 'fk', no label, plain '1-n' cardinality, and a same-direction
// fk-role field to derive it from. Everything else — a labelled fk rel, one with a
// hand-set cardinality (e.g. the '1-1' of an identifying, shared-pk relationship),
// or one with no backing fk field at all (e.g. an untagged event-stream reference) —
// serializes explicitly, so save→load survives it byte-honestly instead of quietly
// dropping it.

import type { Model, Relationship } from '../types';

function isFullyReDerivable(model: Model, r: Relationship): boolean {
  if (r.kind !== 'fk' || r.label !== null || r.cardinality !== '1-n') return false;
  const target = model.entityById.get(r.target);
  const field = target?.fields.find((f) => f.name === r.targetField);
  return !!field && field.role === 'fk' && field.ref === r.source && (field.refField ?? 'id') === r.sourceField;
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
      })),
    })),
    relationships: model.relationships
      .filter((r) => !isFullyReDerivable(model, r))
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
