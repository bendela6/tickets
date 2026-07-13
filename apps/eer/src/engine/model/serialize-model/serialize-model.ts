// Model → raw JSON file shape. Inverse of load-model for everything the editor
// touches: meta, kinds, colours, groups+bounds, entities+positions+fields, and
// relationships. Underscore-prefixed derived state is never serialized. A
// relationship is omitted ONLY when load-model is guaranteed to reconstruct it
// byte-for-byte: kind 'fk', no label, plain '1-n' cardinality, an id that is
// ITSELF the derived scheme (not just a coincidentally-matching backing field —
// a hand-authored id, however plain-looking, is authored data), and a
// same-direction fk-role field to derive it from. Everything else — a labelled
// fk rel, one with a hand-set cardinality (e.g. the '1-1' of an identifying,
// shared-pk relationship), one with a custom id, or one with no backing fk
// field at all (e.g. an untagged event-stream reference) — serializes
// explicitly, so save→load survives it byte-honestly instead of quietly
// dropping it (or worse, silently renaming it).

import { isFullyReDerivable } from '../is-derivable-shaped';
import type { Model } from '../types';

// A relationship is safe to drop from the file only when BOTH (a) its shape
// carries nothing beyond what fk-field derivation would produce — same check
// apply-model-edit uses to decide what's safe to discard on every edit — AND
// (b) the field load-model would derive it FROM still backs it exactly.
// Checking only (b), as this used to, let a hand-authored id (e.g.
// 'owns-custom-id') through whenever its backing field happened to match:
// load-model has no way to know that custom id, so it resurrected the rel
// under the derived one on the next load, silently renaming it.
// isFullyReDerivable (and isDerivableShaped underneath it) is shared with
// apply-model-edit so the two "is this rel doing anything a human/tool
// couldn't reproduce" checks can't drift apart again — see that module's own
// comment for the bug that let a derivable-shaped-but-not-fully-re-derivable
// rel (backing field's ref/refField intact, but not tagged role:'fk') vanish
// silently on an unrelated edit before this was shared.

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
