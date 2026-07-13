// Structural model edits — groups/tables/meta — the pure heart of the model
// editor. Every branch returns a brand-new Model via spread + rebuilt maps; the
// input is never mutated (the future editor reducer relies on that). Relationships
// are not hand-edited directly: `finalize` re-derives the whole relationship list
// from the (freshly rebuilt) entities' constraints on every edit — see
// derive-relationships.ts for the one-edge-per-fk-constraint rule and how it
// keeps authored non-fk relationships verbatim.
//
// upsertEntity takes `constraints`/`indexes` VERBATIM from its caller instead of
// re-deriving pk/fk from field role/ref (a prior version did that, and wiped a
// real-`constraints`-authored table's keys — and every edge attached to
// them — the moment it was saved with no field-role change to trigger on,
// because such a table has no role/ref at all to regenerate from). The field
// grid has no key-editing UI any more (see field-grid.tsx) — a real constraints
// editor is a later task; until then, an edit can only carry a table's
// constraints/indexes through unchanged, never author new ones (except a brand
// new table's default `id` pk, built once at creation).

import { measureEntity } from '../../geometry/measure-entity';
import { LAYOUT_MARGIN } from '../../geometry/metrics';
import { deriveRelationships } from '../derive-relationships';
import type { Column, Constraint, Entity, Group, GroupBounds, Model, TableIndex } from '../types';

export interface EditField {
  name: string;
  type: string;
  title: string | null;
  description: string | null;
  // Neither has an editable column in FieldGrid yet — carried through
  // untouched so a no-op Save can't destroy it. Same passthrough reasoning as
  // `title`.
  nullable: boolean;
  default: string | null;
}

export interface EditEntity {
  id: string;
  label: string;
  group: string;
  description: string | null;
  fields: EditField[];
  // Verbatim — see the header comment. The editor cannot yet create or edit a
  // constraint/index; it only ever passes a table's own current ones through.
  constraints: Constraint[];
  indexes: TableIndex[];
}

export type ModelEdit =
  | { kind: 'setMeta'; title: string; description: string }
  | { kind: 'upsertGroup'; group: { id: string; label: string; parent: string | null } }
  | { kind: 'deleteGroup'; id: string }
  | { kind: 'upsertEntity'; entity: EditEntity }
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

// Every {entityId, field} elsewhere in the model with an fk CONSTRAINT
// pointing at `entityId` — delete-confirm copy ("N fields reference this
// table") reads this. Constraints are the source of truth for what
// references what now (see derive-relationships.ts); `field` is the
// constraint's own columns, joined, so a composite fk still reads as one row
// rather than being silently truncated to its first column.
export function fkRefsTo(model: Model, entityId: string): { entityId: string; field: string }[] {
  const refs: { entityId: string; field: string }[] = [];
  for (const e of model.entities)
    for (const c of e.constraints)
      if (c.kind === 'fk' && c.refTable === entityId) refs.push({ entityId: e.id, field: c.columns.join(', ') });
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

// Duplicate names are rejected up front rather than silently producing an
// unresolvable field later. Key/reference validation is gone along with
// EditField's role/ref/refField — the field grid can't author a constraint, so
// there's nothing here to validate; see the module header comment.
function validateEditFields(fields: EditField[]): void {
  const seen = new Set<string>();
  for (const f of fields) {
    if (seen.has(f.name)) throw new Error(`Duplicate field name "${f.name}".`);
    seen.add(f.name);
  }
}

function upsertEntity(model: Model, e: EditEntity): Model {
  if (!model.groups.some((g) => g.id === e.group)) throw new Error(`Unknown group "${e.group}".`);
  validateEditFields(e.fields);

  // The editor form has no "title" input, but EditField still carries title
  // through as an untouched passthrough (table-modal's toEditField reads it in,
  // FieldGrid never exposes it as an editable column) — so a no-op Save must
  // not destroy titles the file already had. See EditField's own field comment.
  // EditField has no role/ref/refField to carry — constraints own that data
  // now (see the module header comment); the resulting Column is just the
  // plain name/type/title/description/nullable/default shape.
  const columns: Column[] = e.fields.map((f) => ({
    name: f.name,
    type: f.type,
    title: f.title,
    description: f.description,
    nullable: f.nullable,
    default: f.default,
  }));
  const existing = model.entityById.get(e.id);
  let entity: Entity;
  if (existing) {
    entity = measureEntity({
      ...existing,
      label: e.label,
      group: e.group,
      description: e.description,
      columns,
      constraints: e.constraints,
      indexes: e.indexes,
    });
  } else {
    const box = model._groupBounds.find((b) => b.id === e.group);
    const x = box ? box.x + SPAWN_OFFSET : SPAWN_OFFSET;
    const y = box ? box.y + SPAWN_OFFSET : SPAWN_OFFSET;
    entity = measureEntity({
      id: e.id,
      label: e.label,
      group: e.group,
      description: e.description,
      columns,
      constraints: e.constraints,
      indexes: e.indexes,
      x,
      y,
      _w: 0,
      _h: 0,
    });
  }

  const entities = existing ? model.entities.map((x) => (x.id === e.id ? entity : x)) : [...model.entities, entity];
  return { ...model, entities };
}

// Deleting a table must scrub every OTHER table's fk CONSTRAINT pointing at it
// — constraints are the only place a reference lives now (Column carries no
// ref of its own; see types.ts) — or the constraint survives (fkRefsTo,
// serialize-model, and the FK badge in columnRoles all read constraints).
// A surviving stale fk constraint desyncs fkRefsTo (which reports "N
// references" honestly) from what delete actually clears, gets written back
// out to the file on save, and — because upsertEntity passes constraints
// through verbatim — resurrects a phantom edge the moment a table with the
// deleted id is re-created. Only fk constraints whose refTable is the deleted
// entity are dropped; indexes/unique/check/pk (and columns) are untouched.
function deleteEntity(model: Model, id: string): Model {
  if (!model.entityById.has(id)) throw new Error(`Unknown entity "${id}".`);
  const entities = model.entities
    .filter((e) => e.id !== id)
    .map((e) => {
      const hasStaleFk = e.constraints.some((c) => c.kind === 'fk' && c.refTable === id);
      if (!hasStaleFk) return e;
      return {
        ...e,
        constraints: e.constraints.filter((c) => !(c.kind === 'fk' && c.refTable === id)),
      };
    });
  return { ...model, entities };
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
