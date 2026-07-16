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
// grid itself has no key-editing UI (see columns-grid.tsx) — constraints/
// indexes are authored separately, by <ConstraintsEditor/>/<IndexesEditor/>,
// and passed through here as their own draft state, verbatim.
//
// "Verbatim" only covers the edited entity's OWN shape, though — it does not
// exempt an edit from checking what ELSE in the model points at it. Renaming
// or removing one of its columns can silently orphan an INBOUND fk constraint
// sitting on some other table (deleteEntity already scrubs those on a full
// delete — see its own header comment — the same invariant applies here, just
// enforced before-the-fact instead of cleaned up after): validateInboundReferences
// below rejects such an edit rather than writing a dangling fk to the file.

import { measureEntity } from '../../geometry/measure-entity';
import { LAYOUT_MARGIN } from '../../geometry/metrics';
import { deriveRelationships } from '../derive-relationships';
import { formatType, parseType } from '../pg-types';
import { MAX_GROUP_DEPTH } from '../types';
import type { Column, Constraint, EnumDecl, Entity, Generated, Group, GroupBounds, Identity, Model, TableIndex } from '../types';

// Tags a validation throw with the modal TAB whose editor a user actually
// fixes it on — 'columns' (this entity's own field list — including any
// edit that would orphan an INBOUND fk sitting on some OTHER table, since
// the fix there is still a column edit: undo the rename/removal),
// 'constraints', or 'indexes'. table-modal.tsx reads `.field` directly,
// live (every render, pre-dispatch — see its own header comment), to light
// the right tab's error count without ever having to guess from the
// message's prose. A prior version guessed from prose via a regex
// (tabForErrorMessage) — cheap to write, but a message that happens to
// contain another tab's keyword (validateInboundReferences' "Cannot remove
// column ... has a foreign key ... referencing it" contains "foreign key")
// silently misrouted to the wrong tab, and a future reword of any message
// below would silently break the routing with zero test failures, since
// nothing pinned the regex to the message text. `field` is ADDITIVE — every
// message string below is unchanged from its plain-Error original, since
// other callers/tests still match on the text.
export class ModelEditError extends Error {
  constructor(
    message: string,
    readonly field: 'columns' | 'constraints' | 'indexes',
  ) {
    super(message);
    this.name = 'ModelEditError';
  }
}

export interface EditField {
  name: string;
  type: string;
  title: string | null;
  description: string | null;
  nullable: boolean;
  default: string | null;
  // The draft (EditField) is the source of truth for a column now — the
  // caller (table-modal's toEditField) copies these straight from the
  // existing Column, same as title/description. They used to be
  // reconstructed here by looking up the PRIOR entity's column of the same
  // NAME — which silently dropped them on a rename (the new name has no
  // match among the prior columns). Carrying them on the payload itself
  // means a rename can no longer lose them: upsertEntity below takes them
  // verbatim, exactly like constraints/indexes.
  identity: Identity | null;
  generated: Generated | null;
}

export interface EditEntity {
  id: string;
  label: string;
  group: string;
  description: string | null;
  // No editor UI sets this yet (see table-modal's toEditField/save) — carried
  // verbatim off the existing entity by the caller, same reasoning as
  // identity/generated on EditField: defaulting an absent value to null here
  // would silently strip a schema-qualified table's schema on its very next
  // no-op Save.
  schema: string | null;
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
  | { kind: 'renameEntity'; from: string; to: string }
  | { kind: 'deleteEntity'; id: string }
  | { kind: 'upsertEnum'; enum: EnumDecl }
  | { kind: 'renameEnum'; from: string; to: string }
  | { kind: 'deleteEnum'; name: string };

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
    case 'renameEntity':
      return finalize(renameEntity(model, edit.from, edit.to));
    case 'deleteEntity':
      return finalize(deleteEntity(model, edit.id));
    case 'upsertEnum':
      return finalize(upsertEnum(model, edit.enum));
    case 'renameEnum':
      return finalize(renameEnum(model, edit.from, edit.to));
    case 'deleteEnum':
      return finalize(deleteEnum(model, edit.name));
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

// Every {entityId, column} elsewhere in the model whose TYPE parses to this
// enum's name as its base (array dimensions and params stripped) — the same
// dependency deleteEnum refuses to break, and renameEnum re-points wholesale.
export function enumRefsTo(model: Model, name: string): { entityId: string; column: string }[] {
  const out: { entityId: string; column: string }[] = [];
  for (const e of model.entities) {
    for (const c of e.columns) {
      if (parseType(c.type).base === name) out.push({ entityId: e.id, column: c.name });
    }
  }
  return out;
}

function upsertEnum(model: Model, next: EnumDecl): Model {
  if (!next.name.trim()) throw new Error('Enum name must not be blank.');
  const isNew = !model.enums.some((e) => e.name === next.name);
  const enums = isNew ? [...model.enums, next] : model.enums.map((e) => (e.name === next.name ? next : e));
  return { ...model, enums };
}

// Rewrites the enum's own declaration AND every column typed to it —
// otherwise a rename would desync the enum from every column still spelling
// its OLD name, the same "derived value regenerated from a lossy source"
// shape every other guard in this file exists to prevent. Array dimensions
// and any params survive: only the base name changes.
function renameEnum(model: Model, from: string, to: string): Model {
  if (!model.enums.some((e) => e.name === from)) throw new Error(`Unknown enum "${from}".`);
  if (!to.trim()) throw new Error('Enum name must not be blank.');
  if (from !== to && model.enums.some((e) => e.name === to)) throw new Error(`Enum "${to}" already exists.`);

  const enums = model.enums.map((e) => (e.name === from ? { ...e, name: to } : e));
  const entities = model.entities.map((e) => ({
    ...e,
    columns: e.columns.map((c) => {
      const p = parseType(c.type);
      if (p.base !== from) return c;
      return { ...c, type: formatType(to, p.params, p.arrays) };
    }),
  }));
  return { ...model, enums, entities };
}

// Same refusal shape as validateInboundReferences above: reject the edit and
// name every dependent, rather than deleting the enum out from under columns
// that would be left pointing at a type the file no longer declares.
function deleteEnum(model: Model, name: string): Model {
  if (!model.enums.some((e) => e.name === name)) throw new Error(`Unknown enum "${name}".`);
  const refs = enumRefsTo(model, name);
  if (refs.length > 0) {
    const list = refs.map((r) => `${r.entityId}.${r.column}`).join(', ');
    throw new Error(`Cannot delete enum "${name}": still used by ${list}.`);
  }
  return { ...model, enums: model.enums.filter((e) => e.name !== name) };
}

function upsertGroup(model: Model, g: { id: string; label: string; parent: string | null }): Model {
  if (g.parent != null) {
    if (g.parent === g.id) throw new Error(`Group "${g.id}" cannot be its own parent.`);
    const parent = model.groups.find((x) => x.id === g.parent);
    if (!parent) throw new Error(`Unknown parent group "${g.parent}".`);
    // Nesting is unbounded, but the parent chain must stay acyclic: walking up
    // from the chosen parent must never reach g itself (that would make g its
    // own ancestor). The depth cap is only a runaway backstop, same as load-model.
    const seen = new Set<string>([g.id]);
    let cur: Group | undefined = parent;
    let depth = 0;
    while (cur) {
      if (seen.has(cur.id)) throw new Error(`Group "${g.id}" cannot nest under its own descendant "${g.parent}".`);
      seen.add(cur.id);
      if (++depth > MAX_GROUP_DEPTH) throw new Error(`Group nesting exceeds ${MAX_GROUP_DEPTH} levels.`);
      cur = cur.parent != null ? model.groups.find((x) => x.id === cur!.parent) : undefined;
    }
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

// Duplicate/blank names are rejected up front rather than silently producing
// an unresolvable column later.
function validateEditFields(fields: EditField[]): void {
  const seen = new Set<string>();
  for (const f of fields) {
    if (!f.name.trim()) throw new ModelEditError('Column name must not be blank.', 'columns');
    if (seen.has(f.name)) throw new ModelEditError(`Duplicate column name "${f.name}".`, 'columns');
    seen.add(f.name);
  }
}

// The field grid has no key-editing UI itself (see the module header
// comment) — constraints/indexes come from <ConstraintsEditor/>/
// <IndexesEditor/>'s own draft state — and even a verbatim passthrough can
// carry a structurally broken schema in (a hand-built ModelEdit, a UI bug,
// …). These are the real Postgres-shaped rules a table's constraints/indexes
// must satisfy against ITS OWN edited column list (and, for fk, the target
// entity's), checked at the one point an edit is actually authored — before
// columnRoles/deriveRelationships/serialize-model ever have to guess at a
// broken shape.
function validateConstraints(model: Model, e: EditEntity): void {
  const ownColumns = new Set(e.fields.map((f) => f.name));
  // A brand-new entity may self-reference its own not-yet-existing row (see
  // the "self-reference" test in apply-model-edit.test.ts) — refTable === e.id
  // resolves against the columns being authored in THIS edit, not whatever
  // (nonexistent) entity might already be in the model under that id.
  const targetColumns = (refTable: string): Set<string> | null => {
    if (refTable === e.id) return ownColumns;
    const target = model.entityById.get(refTable);
    return target ? new Set(target.columns.map((c) => c.name)) : null;
  };

  let pkCount = 0;
  const constraintNames = new Set<string>();
  for (const c of e.constraints) {
    if (c.name) {
      if (constraintNames.has(c.name)) throw new ModelEditError(`Duplicate constraint name "${c.name}".`, 'constraints');
      constraintNames.add(c.name);
    }

    if (c.kind === 'check') {
      if (!c.expression.trim()) throw new ModelEditError(`Check constraint "${c.id}" must have a non-blank expression.`, 'constraints');
      // Unlike pk/unique/fk (which Postgres/drizzle really do auto-name when
      // left blank — see generated-constraint-name.ts), a CHECK constraint has
      // NO auto-generated name: drizzle's own check() builder requires one
      // (export-drizzle.ts's emitCheck THROWS on a blank name rather than
      // guessing one). A blank check name must be rejected here too, or it
      // sails through Save only to blow up later at export (Task 12 review,
      // Finding 2).
      if (!c.name || !c.name.trim()) throw new ModelEditError(`Check constraint "${c.id}" must have a name.`, 'constraints');
      continue;
    }

    if (c.columns.length === 0) throw new ModelEditError(`Constraint "${c.id}" must reference at least one column.`, 'constraints');
    for (const col of c.columns) {
      if (!ownColumns.has(col)) throw new ModelEditError(`Constraint "${c.id}" references unknown column "${col}".`, 'constraints');
    }

    if (c.kind === 'pk') {
      pkCount++;
      if (pkCount > 1) throw new ModelEditError(`Table "${e.id}" may have only one primary key constraint.`, 'constraints');
    }

    if (c.kind === 'fk') {
      const refCols = targetColumns(c.refTable);
      if (!refCols) throw new ModelEditError(`Foreign key constraint "${c.id}" references unknown table "${c.refTable}".`, 'constraints');
      if (c.columns.length !== c.refColumns.length)
        throw new ModelEditError(`Foreign key constraint "${c.id}" must reference the same number of columns as it defines.`, 'constraints');
      for (const col of c.refColumns) {
        if (!refCols.has(col)) throw new ModelEditError(`Foreign key constraint "${c.id}" references unknown column "${col}".`, 'constraints');
      }
    }
  }

  const indexNames = new Set<string>();
  for (const ix of e.indexes) {
    if (ix.name) {
      if (indexNames.has(ix.name)) throw new ModelEditError(`Duplicate index name "${ix.name}".`, 'indexes');
      indexNames.add(ix.name);
    }
    if (ix.columns.length === 0) throw new ModelEditError(`Index "${ix.id}" must reference at least one column.`, 'indexes');
    for (const col of ix.columns) {
      // An expression index column is raw SQL, not a column name — nothing to
      // check it against.
      if (!col.isExpression && !ownColumns.has(col.expression))
        throw new ModelEditError(`Index "${ix.id}" references unknown column "${col.expression}".`, 'indexes');
    }
  }
}

// validateConstraints (above) only checks the edited entity's OWN
// constraints against ITS OWN edited column list — it has no way to notice
// that renaming or dropping one of those columns just orphaned an INBOUND fk
// constraint sitting on some OTHER table. deleteEntity scrubs those on a full
// delete (see its own header comment); a column rename/removal via
// upsertEntity used to have no equivalent guard at all, so the fix here was
// silently accepted, the reference's own refColumns went dangling in the
// file, and the derived edge (and any label on it) vanished for good on the
// very next load. Reject the edit instead, naming the referencing table,
// its constraint, and the column that would go missing — consistent with
// every other guard in this file, so it surfaces via ui.editError.
function validateInboundReferences(model: Model, e: EditEntity): void {
  const ownColumns = new Set(e.fields.map((f) => f.name));
  for (const other of model.entities) {
    if (other.id === e.id) continue; // self-references are covered by validateConstraints above
    for (const c of other.constraints) {
      if (c.kind !== 'fk' || c.refTable !== e.id) continue;
      for (const col of c.refColumns) {
        if (!ownColumns.has(col)) {
          // 'columns', not 'constraints': `other` (not the entity being
          // edited) owns the fk constraint — the fix here is to undo the
          // rename/removal on THIS entity's Columns tab, not to touch any
          // constraint of its own. The message still contains the words
          // "foreign key" (mirroring Postgres' own wording for this error),
          // which a substring-matching regex would have routed to
          // Constraints — exactly the bug `field` exists to prevent.
          throw new ModelEditError(`Cannot remove column "${col}": table "${other.id}" has a foreign key (${c.id}) referencing it.`, 'columns');
        }
      }
    }
  }
}

function upsertEntity(model: Model, e: EditEntity): Model {
  if (!model.groups.some((g) => g.id === e.group)) throw new Error(`Unknown group "${e.group}".`);
  validateEditFields(e.fields);
  validateConstraints(model, e);
  validateInboundReferences(model, e);

  // The editor form has no "title" input, but EditField still carries title
  // through as an untouched passthrough (table-modal's toEditField reads it in,
  // ColumnsGrid never exposes it as an editable column) — so a no-op Save must
  // not destroy titles the file already had. identity/generated are the same
  // kind of passthrough (this editor has no UI for them yet) — but unlike
  // title, they are taken verbatim from the EditField itself, not
  // reconstructed by looking up the PRIOR entity's column of the same NAME.
  // A prior version did that lookup, which broke the moment a column was
  // renamed (a supported edit): the new name has no match among the prior
  // columns, so identity/generated silently reset to null. The draft is the
  // source of truth for a column now — see EditField's own comment.
  const existing = model.entityById.get(e.id);
  const columns: Column[] = e.fields.map((f) => ({
    name: f.name,
    type: f.type,
    title: f.title,
    description: f.description,
    nullable: f.nullable,
    default: f.default,
    identity: f.identity,
    generated: f.generated,
  }));
  let entity: Entity;
  if (existing) {
    entity = measureEntity({
      ...existing,
      label: e.label,
      group: e.group,
      description: e.description,
      schema: e.schema,
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
      schema: e.schema,
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

// Renaming a table changes its id — which is ALSO its physical SQL name on
// export (export-drizzle keys off Entity.id) and the reference key every OTHER
// part of the model points at. So a rename is a rekey of every referrer, or the
// reference dangles: an inbound fk CONSTRAINT's refTable, an authored (non-
// derivable) relationship's source/target endpoint, a colour override keyed by
// id, and a hand-arranged saved-layout position keyed by id. Derived fk edges
// need no rewrite here — finalize() re-derives them from the (rekeyed)
// constraints under the new id. label is pinned to id for tables (the single
// Name field IS the identifier), so it moves with the id too.
function renameEntity(model: Model, from: string, to: string): Model {
  if (!model.entityById.has(from)) throw new Error(`Unknown entity "${from}".`);
  if (!to.trim()) throw new Error('Table name must not be blank.');
  if (from === to) return model;
  if (model.entityById.has(to)) throw new Error(`A table with id "${to}" already exists.`);

  const entities = model.entities.map((e) => {
    const constraints = e.constraints.map((c) => (c.kind === 'fk' && c.refTable === from ? { ...c, refTable: to } : c));
    const renamed = e.id === from ? { id: to, label: to } : {};
    return { ...e, ...renamed, constraints };
  });

  // Authored relationships (non-fk / polymorphic) survive the rename; derived
  // fk edges are regenerated by finalize() and need no rewrite, but rewriting
  // them here is harmless and keeps a stale endpoint from ever reaching
  // deriveRelationships' resolve filter (which would silently drop it).
  const relationships = model.relationships.map((r) => ({
    ...r,
    source: r.source === from ? to : r.source,
    target: r.target === from ? to : r.target,
  }));

  const colors = rekey(model.colors, from, to);
  const _savedLayout = model._savedLayout
    ? { ...model._savedLayout, entities: rekey(model._savedLayout.entities, from, to) }
    : model._savedLayout;

  return { ...model, entities, relationships, colors, _savedLayout };
}

// Move the value at `from` to `to` in a readonly string-keyed map, leaving
// every other entry untouched (no-op when `from` isn't present).
function rekey<V>(map: ReadonlyMap<string, V>, from: string, to: string): Map<string, V> {
  const next = new Map(map);
  if (next.has(from)) {
    next.set(to, next.get(from)!);
    next.delete(from);
  }
  return next;
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
