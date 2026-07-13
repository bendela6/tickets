// Structural model edits — groups/tables/meta — the pure heart of the model
// editor. Every branch returns a brand-new Model via spread + rebuilt maps; the
// input is never mutated (the future editor reducer relies on that). Relationships
// are not hand-edited directly, but editing is non-destructive for hand-authored
// data: after every edit, `relationships` = every explicit relationship whose
// endpoints (entity + field, both sides) still resolve AND that either (a)
// carries anything derivation couldn't reproduce (custom id, label, or
// hand-set cardinality — see isDerivableShaped) or (b) is derivable-shaped but
// NOT fully re-derivable (see isFullyReDerivable) — its backing field's
// ref/refField still match but it isn't tagged role:'fk', so the derive loop
// below will never regenerate it — kept verbatim in both cases; PLUS one
// derived rel for each fk-role field whose ref'd entity still carries the
// named refField (renaming/removing that field leaves `ref` resolving fine
// while `refField` goes stale — no rel is derived from it) and whose
// {(ref,refField),(entity,field)} endpoint pair isn't already covered — in
// either direction — by one of those kept rels. A fully-re-derivable rel is
// never kept: it re-derives from the CURRENT fields each time, so a no-op edit
// reproduces an identical object while clearing a field's fk role (even
// keeping its name, and clearing its ref alongside — see field-grid.tsx)
// genuinely removes its edge.

import { measureEntity } from '../../geometry/measure-entity';
import { LAYOUT_MARGIN } from '../../geometry/metrics';
import { hasBackingField, isDerivableShaped, isFullyReDerivable } from '../is-derivable-shaped';
import type { Entity, Field, Group, GroupBounds, Model, Relationship } from '../types';

export interface EditField {
  name: string;
  type: string;
  role: 'pk' | 'fk' | null;
  ref: string | null;
  refField: string | null;
  title: string | null;
  description: string | null;
}

export type ModelEdit =
  | { kind: 'setMeta'; title: string; description: string }
  | { kind: 'upsertGroup'; group: { id: string; label: string; parent: string | null } }
  | { kind: 'deleteGroup'; id: string }
  | { kind: 'upsertEntity'; entity: { id: string; label: string; group: string; description: string | null; fields: EditField[] } }
  | { kind: 'deleteEntity'; id: string };

// A brand-new group's box: parked to the right of everything laid out so far.
const NEW_GROUP_W = 360;
const NEW_GROUP_H = 260;
const NEW_GROUP_Y = 40;
const NEW_GROUP_GAP = 80;
const SPAWN_OFFSET = 50;

export function applyModelEdit(model: Model, edit: ModelEdit): Model {
  switch (edit.kind) {
    case 'setMeta':
      return finalize({ ...model, meta: { title: edit.title, description: edit.description } });
    case 'upsertGroup':
      return finalize(upsertGroup(model, edit.group));
    case 'deleteGroup':
      return finalize(deleteGroup(model, edit.id));
    case 'upsertEntity':
      return finalize(upsertEntity(model, edit.entity));
    case 'deleteEntity':
      return finalize(deleteEntity(model, edit.id));
  }
}

// Every {entityId, field} elsewhere in the model whose field references
// `entityId` — delete-confirm copy ("N fields reference this table") reads this.
// Matches on `ref` alone (not `role === 'fk'`) because that's what deleteEntity
// itself clears; a field can't dangle a ref to a deleted entity regardless of
// whether its role was correctly tagged 'fk'.
export function fkRefsTo(model: Model, entityId: string): { entityId: string; field: string }[] {
  const refs: { entityId: string; field: string }[] = [];
  for (const e of model.entities) for (const f of e.fields) if (f.ref === entityId) refs.push({ entityId: e.id, field: f.name });
  return refs;
}

function upsertGroup(model: Model, g: { id: string; label: string; parent: string | null }): Model {
  if (g.parent != null) {
    if (g.parent === g.id) throw new Error(`Group "${g.id}" cannot be its own parent.`);
    const parent = model.groups.find((x) => x.id === g.parent);
    if (!parent) throw new Error(`Unknown parent group "${g.parent}".`);
    if (parent.parent != null)
      throw new Error(`Group "${g.parent}" is itself a subgroup; subgroup nesting is one level only.`);
  }

  const isNew = !model.groups.some((x) => x.id === g.id);

  if (!isNew) {
    const groups = model.groups.map((x) => (x.id === g.id ? { ...x, label: g.label, parent: g.parent } : x));
    const _groupBounds = model._groupBounds.map((b) =>
      b.id === g.id ? { ...b, label: g.label, parent: g.parent, level: g.parent ? 1 : 0 } : b,
    );
    return { ...model, groups, _groupBounds };
  }

  const order = model.groups.length ? Math.max(...model.groups.map((x) => x.order)) + 1 : 0;
  const group: Group = { id: g.id, label: g.label, order, parent: g.parent };
  const box: GroupBounds = {
    id: g.id,
    label: g.label,
    x: model._content.w + NEW_GROUP_GAP,
    y: NEW_GROUP_Y,
    w: NEW_GROUP_W,
    h: NEW_GROUP_H,
    parent: g.parent,
    level: g.parent ? 1 : 0,
  };
  return { ...model, groups: [...model.groups, group], _groupBounds: [...model._groupBounds, box] };
}

function deleteGroup(model: Model, id: string): Model {
  if (!model.groups.some((g) => g.id === id)) throw new Error(`Unknown group "${id}".`);
  const memberCount = model.entities.filter((e) => e.group === id).length;
  if (memberCount > 0) throw new Error(`Group still contains ${memberCount} table(s)`);
  if (model.groups.some((g) => g.parent === id)) throw new Error('Group has subgroups');
  return {
    ...model,
    groups: model.groups.filter((g) => g.id !== id),
    _groupBounds: model._groupBounds.filter((b) => b.id !== id),
  };
}

// Duplicate names, and fk rows that can never resolve, are rejected up front
// rather than silently producing an unresolvable field or relationship later.
// `upsertId`'s own (about-to-be-saved) field list stands in for `entityById`
// when a field self-references the entity being upserted (e.g. a fresh `users`
// row with a `manager_id` fk pointing at its own not-yet-existing `id`).
function validateEditFields(model: Model, upsertId: string, fields: EditField[]): void {
  const seen = new Set<string>();
  for (const f of fields) {
    if (seen.has(f.name)) throw new Error(`Duplicate field name "${f.name}".`);
    seen.add(f.name);

    if (f.role !== 'fk') continue;
    if (!f.ref) throw new Error(`Field "${f.name}" has role "fk" but no "ref".`);
    const targetFields = f.ref === upsertId ? fields : model.entityById.get(f.ref)?.fields;
    if (!targetFields) throw new Error(`Field "${f.name}" references unknown entity "${f.ref}".`);
    const refField = f.refField ?? 'id';
    if (!targetFields.some((tf) => tf.name === refField))
      throw new Error(`Field "${f.name}" references unknown field "${f.ref}.${refField}".`);
  }
}

function upsertEntity(
  model: Model,
  e: { id: string; label: string; group: string; description: string | null; fields: EditField[] },
): Model {
  if (!model.groups.some((g) => g.id === e.group)) throw new Error(`Unknown group "${e.group}".`);
  validateEditFields(model, e.id, e.fields);

  // The editor form has no "title" input, but EditField still carries title
  // through as an untouched passthrough (table-modal's toEditField reads it in,
  // FieldGrid never exposes it as an editable column) — so a no-op Save must
  // not destroy titles the file already had. See EditField's own field comment.
  const fields: Field[] = e.fields.map((f) => ({
    name: f.name,
    type: f.type,
    role: f.role,
    ref: f.ref,
    refField: f.refField,
    title: f.title,
    description: f.description,
  }));

  const existing = model.entityById.get(e.id);
  let entity: Entity;
  if (existing) {
    entity = measureEntity({ ...existing, label: e.label, group: e.group, description: e.description, fields });
  } else {
    const box = model._groupBounds.find((b) => b.id === e.group);
    const x = box ? box.x + SPAWN_OFFSET : SPAWN_OFFSET;
    const y = box ? box.y + SPAWN_OFFSET : SPAWN_OFFSET;
    entity = measureEntity({ id: e.id, label: e.label, group: e.group, description: e.description, fields, x, y, _w: 0, _h: 0 });
  }

  const entities = existing ? model.entities.map((x) => (x.id === e.id ? entity : x)) : [...model.entities, entity];
  return { ...model, entities };
}

function deleteEntity(model: Model, id: string): Model {
  if (!model.entityById.has(id)) throw new Error(`Unknown entity "${id}".`);
  const entities = model.entities
    .filter((e) => e.id !== id)
    .map((e) =>
      e.fields.some((f) => f.ref === id)
        ? { ...e, fields: e.fields.map((f) => (f.ref === id ? { ...f, role: null, ref: null, refField: null } : f)) }
        : e,
    );
  return { ...model, entities };
}

function hasField(entity: Entity | undefined, name: string): boolean {
  return !!entity && entity.fields.some((f) => f.name === name);
}

// A relationship's endpoint pair is the UNORDERED set {(entityA,fieldA),(entityB,fieldB)}
// — a rel and its mirror image (source/target swapped) cover the same pair. Sorting
// the two endpoints before stringifying makes the key direction-independent; nesting
// inside JSON.stringify (rather than joining with a hand-picked delimiter) sidesteps
// any risk of an id/field name colliding with the separator itself.
function pairKey(aEntity: string, aField: string, bEntity: string, bField: string): string {
  const a: [string, string] = [aEntity, aField];
  const b: [string, string] = [bEntity, bField];
  const [lo, hi] = JSON.stringify(a) <= JSON.stringify(b) ? [a, b] : [b, a];
  return JSON.stringify([lo, hi]);
}

// A relationship is still valid once both its endpoints — entity AND named field on
// that entity, on both sides — resolve in the current model. Renaming or deleting a
// field (or its entity) invalidates any explicit rel that pointed at it.
function isValidRelationship(model: Model, r: Relationship): boolean {
  return hasField(model.entityById.get(r.source), r.sourceField) && hasField(model.entityById.get(r.target), r.targetField);
}

// Every still-valid, non-derivable-shaped explicit relationship — ANY kind, kept
// verbatim (id, label, cardinality untouched) — plus one derived rel per fk-role
// field whose endpoint pair isn't already covered by one of those kept rels.
// Non-destructive for authored data (labels/custom cardinality/custom ids survive
// edits), while derivable-shaped rels track their backing field's current state.
function deriveRelationships(model: Model): Relationship[] {
  const kept = model.relationships.filter((r) => {
    if (!isValidRelationship(model, r)) return false;
    if (!isDerivableShaped(r)) return true;
    // Derivable-shaped: dropping it here is only safe when the derive loop
    // below will actually put an equivalent one back (isFullyReDerivable — its
    // backing field is tagged role:'fk'), or when nothing backs it at all
    // anymore (ref/refField cleared or repointed — hasBackingField false). A
    // field whose ref/refField still match but ISN'T tagged 'fk' (e.g. a
    // shared-pk identifying reference, like the seed's outbox.event_id: role
    // 'pk', ref 'events') falls through both: the derive loop only fires for
    // role:'fk' fields, so unconditionally discarding here (the old bug) would
    // silently drop real data on the very next unrelated edit.
    return hasBackingField(model, r) && !isFullyReDerivable(model, r);
  });
  const coveredPairs = new Set(kept.map((r) => pairKey(r.source, r.sourceField, r.target, r.targetField)));

  const derived: Relationship[] = [];
  for (const e of model.entities)
    for (const f of e.fields) {
      if (f.role !== 'fk' || !f.ref || !model.entityById.has(f.ref)) continue;
      const sourceField = f.refField ?? 'id';
      // The ref'd entity existing isn't enough — it must still carry the named
      // refField itself. Renaming/removing that field (e.g. a pk rename) leaves
      // `ref` resolving fine while `refField` goes stale; deriving anyway would
      // emit a rel whose sourceField doesn't exist anywhere, which downstream
      // geometry resolves to fieldIndex -1 instead of failing loudly.
      if (!model.entityById.get(f.ref)!.fields.some((x) => x.name === sourceField)) continue;
      if (coveredPairs.has(pairKey(f.ref, sourceField, e.id, f.name))) continue;
      derived.push({
        id: `e-${f.ref}.${sourceField}->${e.id}.${f.name}`,
        source: f.ref,
        sourceField,
        target: e.id,
        targetField: f.name,
        cardinality: '1-n',
        cardinalityInferred: true,
        kind: 'fk',
        label: null,
      });
    }
  return [...kept, ...derived];
}

// Shared tail for every edit: rebuild entityById, re-derive relationships +
// relById, and grow (never shrink) the content extents to cover every box/card.
function finalize(model: Model): Model {
  const entityById = new Map(model.entities.map((e) => [e.id, e]));
  const withIds = { ...model, entityById };
  const relationships = deriveRelationships(withIds);
  const relById = new Map(relationships.map((r) => [r.id, r]));

  let w = model._content.w;
  let h = model._content.h;
  for (const b of model._groupBounds) {
    w = Math.max(w, b.x + b.w + LAYOUT_MARGIN);
    h = Math.max(h, b.y + b.h + LAYOUT_MARGIN);
  }
  for (const e of model.entities) {
    w = Math.max(w, e.x + e._w + LAYOUT_MARGIN);
    h = Math.max(h, e.y + e._h + LAYOUT_MARGIN);
  }

  return { ...withIds, relationships, relById, _content: { w, h } };
}
