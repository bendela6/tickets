// Structural model edits — groups/tables/meta — the pure heart of the model
// editor. Every branch returns a brand-new Model via spread + rebuilt maps; the
// input is never mutated (the future editor reducer relies on that). Relationships
// are not hand-edited directly: `finalize` re-derives the whole relationship list
// from the (freshly rebuilt) entities' constraints on every edit — see
// derive-relationships.ts for the one-edge-per-fk-constraint rule and how it
// keeps authored non-fk relationships verbatim.

import { measureEntity } from '../../geometry/measure-entity';
import { LAYOUT_MARGIN } from '../../geometry/metrics';
import { deriveRelationships } from '../derive-relationships';
import type { Constraint, Entity, Field, Group, GroupBounds, Model } from '../types';

export interface EditField {
  name: string;
  type: string;
  role: 'pk' | 'fk' | null;
  ref: string | null;
  refField: string | null;
  title: string | null;
  description: string | null;
  // Neither has an editable column in FieldGrid yet (constraints/indexes own
  // this data going forward — see task-2-brief) — carried through untouched so
  // a no-op Save can't destroy it. Same passthrough reasoning as `title`.
  nullable: boolean;
  default: string | null;
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
    nullable: f.nullable,
    default: f.default,
  }));
  const existing = model.entityById.get(e.id);
  let entity: Entity;
  if (existing) {
    // The editor doesn't expose constraint editing yet (EditField only carries
    // legacy role/ref/refField — Task 5/6 add real constraint editing). Only
    // the pk/fk constraints are re-derived from the CURRENT fields on every
    // save (badges/edges read constraints, not fields, since Task 3, so an
    // added/removed/renamed pk or fk field must still take effect); unique,
    // check, and every index are the schema's own data — the role/ref-only
    // editor can't express them yet, so a no-op field save must not silently
    // drop a composite unique constraint, a check constraint, or an index.
    const constraints = regeneratePkFkConstraints(e.fields, existing.constraints);
    entity = measureEntity({
      ...existing,
      label: e.label,
      group: e.group,
      description: e.description,
      fields,
      constraints,
      indexes: existing.indexes,
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
      fields,
      constraints: synthesizeConstraintsFromFields(e.fields),
      indexes: [],
      x,
      y,
      _w: 0,
      _h: 0,
    });
  }

  const entities = existing ? model.entities.map((x) => (x.id === e.id ? entity : x)) : [...model.entities, entity];
  return { ...model, entities };
}

// Mirrors load-model's synthesizeLegacyConstraints: one pk constraint from every
// role:'pk' field (declaration order), one fk constraint per field carrying a
// ref (regardless of role — a shared-primary-key reference is role 'pk' AND a
// ref). Kept as a small local copy rather than importing load-model's private
// helper, since EditField and the raw-JSON field shape it synthesises from
// aren't the same type. Only used for a brand-new entity, which has no prior
// constraints to preserve or reuse ids from.
function synthesizeConstraintsFromFields(fields: EditField[]): Constraint[] {
  const out: Constraint[] = [];
  const pkCols = fields.filter((f) => f.role === 'pk').map((f) => f.name);
  let n = 1;
  if (pkCols.length) out.push({ id: 'c' + n++, kind: 'pk', name: null, columns: pkCols });
  for (const f of fields) {
    if (!f.ref) continue;
    out.push({
      id: 'c' + n++, kind: 'fk', name: null, columns: [f.name],
      refTable: f.ref, refColumns: [f.refField ?? 'id'], onDelete: null, onUpdate: null,
    });
  }
  return out;
}

// For an EXISTING entity: keep its `unique`/`check` constraints exactly as
// stored (the role/ref-only editor can't express or edit them — see the call
// site), and re-derive ONLY `pk`/`fk` from the current fields, the same rule
// synthesizeConstraintsFromFields above uses for a new entity. Ids are reused
// whenever the "same" constraint still exists — the pk constraint's id always
// carries over (there's only ever one), and an fk constraint's id carries over
// when a field with that same name still has a ref — so an edit that doesn't
// touch a given pk/fk field reproduces the identical constraint id, and
// therefore the identical derived relationship id (`rel:<entity>:<constraintId>`,
// see derive-relationships.ts): no edge churn on an unrelated save.
function regeneratePkFkConstraints(fields: EditField[], existing: Constraint[]): Constraint[] {
  const preserved = existing.filter((c) => c.kind === 'unique' || c.kind === 'check');
  const takenIds = new Set(existing.map((c) => c.id));
  const prevPk = existing.find((c) => c.kind === 'pk');
  const prevFkByColumn = new Map(
    existing.filter((c) => c.kind === 'fk').map((c) => [c.columns[0], c] as const),
  );

  function freshId(): string {
    let n = 1;
    while (takenIds.has('c' + n)) n++;
    const id = 'c' + n;
    takenIds.add(id);
    return id;
  }

  const out: Constraint[] = [...preserved];

  const pkCols = fields.filter((f) => f.role === 'pk').map((f) => f.name);
  if (pkCols.length) out.push({ id: prevPk ? prevPk.id : freshId(), kind: 'pk', name: prevPk?.name ?? null, columns: pkCols });

  for (const f of fields) {
    if (!f.ref) continue;
    const prevFk = prevFkByColumn.get(f.name);
    out.push({
      id: prevFk ? prevFk.id : freshId(),
      kind: 'fk',
      name: prevFk?.name ?? null,
      columns: [f.name],
      refTable: f.ref,
      refColumns: [f.refField ?? 'id'],
      onDelete: prevFk?.onDelete ?? null,
      onUpdate: prevFk?.onUpdate ?? null,
    });
  }

  return out;
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
