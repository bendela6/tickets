// Model → raw JSON file shape. Inverse of load-model for everything the editor
// touches: meta, kinds, colours, groups+bounds, entities+positions+fields, and
// relationships. Underscore-prefixed derived state is never serialized. Fk-kind
// relationships are derived from fk-role fields (see apply-model-edit /
// load-model), so they're skipped here — load-model reconstructs them from the
// fields themselves, and writing them out too would just be redundant, drifting
// data for load-model's dedupe-by-endpoint-tuple to reconcile.

import type { Model } from '../types';

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
