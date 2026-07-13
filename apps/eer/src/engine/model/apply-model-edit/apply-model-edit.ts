// Structural model edits — groups/tables/meta — the pure heart of the model
// editor. Every branch returns a brand-new Model via spread + rebuilt maps; the
// input is never mutated (the future editor reducer relies on that). Relationships
// are not hand-edited: after every edit they are rebuilt from scratch as explicit
// non-fk rels (with valid endpoints) plus one derived rel per fk-role field.

import { measureEntity } from '../../geometry/measure-entity';
import { LAYOUT_MARGIN } from '../../geometry/metrics';
import type { Entity, Field, Group, GroupBounds, Model, Relationship } from '../types';

export interface EditField {
  name: string;
  type: string;
  role: 'pk' | 'fk' | null;
  ref: string | null;
  refField: string | null;
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

// Every {entityId, field} elsewhere in the model whose fk field references
// `entityId` — delete-confirm copy ("N fields reference this table") reads this.
export function fkRefsTo(model: Model, entityId: string): { entityId: string; field: string }[] {
  const refs: { entityId: string; field: string }[] = [];
  for (const e of model.entities)
    for (const f of e.fields) if (f.role === 'fk' && f.ref === entityId) refs.push({ entityId: e.id, field: f.name });
  return refs;
}

function upsertGroup(model: Model, g: { id: string; label: string; parent: string | null }): Model {
  const isNew = !model.groups.some((x) => x.id === g.id);

  if (!isNew) {
    const groups = model.groups.map((x) => (x.id === g.id ? { ...x, label: g.label, parent: g.parent } : x));
    const _groupBounds = model._groupBounds.map((b) =>
      b.id === g.id ? { ...b, label: g.label, parent: g.parent, level: g.parent ? 1 : 0 } : b,
    );
    return { ...model, groups, _groupBounds };
  }

  const order = model.groups.filter((x) => x.parent === g.parent).length;
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

function upsertEntity(
  model: Model,
  e: { id: string; label: string; group: string; description: string | null; fields: EditField[] },
): Model {
  if (!model.groups.some((g) => g.id === e.group)) throw new Error(`Unknown group "${e.group}".`);

  // The editor form has no "title" input — it stays null for anything that
  // passes through here, whether the entity is new or already had titled fields.
  const fields: Field[] = e.fields.map((f) => ({
    name: f.name,
    type: f.type,
    role: f.role,
    ref: f.ref,
    refField: f.refField,
    title: null,
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

// Explicit non-fk rels with endpoints that still resolve, plus one derived rel
// per fk-role field — the single source of truth for `relationships` after any edit.
function deriveRelationships(model: Model): Relationship[] {
  const explicit = model.relationships.filter(
    (r) => r.kind !== 'fk' && model.entityById.has(r.source) && model.entityById.has(r.target),
  );
  const derived: Relationship[] = [];
  for (const e of model.entities)
    for (const f of e.fields)
      if (f.role === 'fk' && f.ref && model.entityById.has(f.ref))
        derived.push({
          id: `e-${f.ref}.${f.refField ?? 'id'}->${e.id}.${f.name}`,
          source: f.ref,
          sourceField: f.refField ?? 'id',
          target: e.id,
          targetField: f.name,
          cardinality: '1-n',
          cardinalityInferred: true,
          kind: 'fk',
          label: null,
        });
  return [...explicit, ...derived];
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
