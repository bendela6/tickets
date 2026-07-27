// Create/edit a table (entity) — name, group, description, a colour override
// (edit mode only, same reasoning as GroupModal: a brand-new entity's id might
// never be saved, so there's nothing yet to key a colour override to), the
// field grid, the constraints editor, the indexes editor, and a guarded
// delete. Fields, constraints AND indexes are all local drafts (EditField[] /
// Constraint[] / TableIndex[]); Save pre-validates then dispatches ONE
// upsertEntity for the whole entity — applyModelEdit's own validation is the
// backstop (duplicate names, dangling fk refs, unknown columns, fk arity, >1
// pk, …), surfaced via ui.editError if this component's own checks miss
// something the engine still rejects.

import { useState } from 'react';

import { entityColor } from '../../engine/colors/entity-color';
import { applyModelEdit as tryApplyModelEdit, fkRefsTo, ModelEditError, type EditField, type ModelEdit } from '../../engine/model/apply-model-edit';
import type { Column, Constraint, Entity, Model, TableIndex } from '../../engine/model/types';
import { useDiagramActions, useDiagramModelOrNull, useDiagramUi } from '../../state/diagram-context';
import { cn } from '@tickets/ui';
import { Modal } from '../modal';
import { ColumnsGrid } from './columns-grid';
import { ConstraintsEditor } from './constraints-editor';
import { IndexesEditor } from './indexes-editor';
import { Tabs, tabButtonId, tabPanelId, type TabItem } from './tabs';

type TabId = 'columns' | 'constraints' | 'indexes';

const field = cn('w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1', 'text-sm text-gray-50');
const label = 'flex flex-col gap-1 text-xs text-gray-400';
const errorRow = cn('flex items-start justify-between gap-2 rounded-md border border-red-600', 'bg-red-950 px-2 py-1 text-sm text-red-400');

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// `title` has no editable column in ColumnsGrid (the grid's "note" column is
// `description`) — it's carried through untouched so a no-op Save can't
// destroy it (see apply-model-edit's EditField and upsertEntity). role/ref/
// refField are gone: the columns grid can't edit keys any more (see its own
// header comment) — constraints are what own that data now, edited
// separately below by <ConstraintsEditor/> and dispatched from its own draft
// state (not re-derived from fields). identity/generated have no ColumnsGrid
// UI either, so they're copied straight from the existing Column, same as
// title — upsertEntity now takes them verbatim off the EditField instead of
// reconstructing them by name lookup (a rename used to silently drop them;
// see apply-model-edit's own comment).
function toEditField(f: Column): EditField {
  return {
    name: f.name,
    type: f.type,
    title: f.title,
    description: f.description ?? '',
    nullable: f.nullable,
    default: f.default,
    identity: f.identity,
    generated: f.generated,
  };
}

// A single fixed modal on screen at once, so a static id namespace is fine.
const TAB_ID_BASE = 'table-modal';

const DEFAULT_PK: EditField = {
  name: 'id',
  type: 'serial',
  title: null,
  description: null,
  nullable: true,
  default: null,
  identity: null,
  generated: null,
};

// A brand-new table's default primary key — the one constraint the editor
// still authors itself, since a fresh table needs SOME key to exist at all.
const DEFAULT_PK_CONSTRAINT: Constraint = { id: 'c1', kind: 'pk', name: null, columns: ['id'] };

function validateDraft(fields: EditField[]): string | null {
  const seen = new Set<string>();
  for (const f of fields) {
    const name = f.name.trim();
    if (!name) return 'Every field needs a name.';
    if (seen.has(name)) return `Duplicate field name "${name}".`;
    seen.add(name);
  }
  return null;
}

// Every group in tree order (roots first, each followed by its descendants,
// indented by depth) — an entity can live in a group at any nesting level.
function groupOptions(model: Model): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const g of model.groups.filter((x) => (x.parent ?? null) === parentId).sort((a, b) => a.order - b.order)) {
      out.push({ id: g.id, label: `${'— '.repeat(depth)}${g.label}` });
      walk(g.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// <EditorModals/> only opens this modal once a model is loaded, but bail
// rather than crash on the very first render of a bare test harness (or a
// boundary re-load race in the real app) — same rationale as GroupModal.
export function TableModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const model = useDiagramModelOrNull();
  if (!model) return null;
  return <TableModalForm model={model} id={id} onClose={onClose} />;
}

function TableModalForm({ model, id, onClose }: { model: Model; id?: string; onClose: () => void }) {
  const ui = useDiagramUi();
  const actions = useDiagramActions();
  const existing: Entity | undefined = id ? model.entityById.get(id) : undefined;
  const isEdit = existing != null;

  const options = groupOptions(model);
  const defaultGroup = options[0]?.id ?? '';

  // The single Name field IS the table's identifier (its SQL name). For a
  // schema-qualified table the id is `schema.name`; the field edits only the
  // name part, so seed it from the physical name and re-qualify on the way out.
  const physicalOf = (id: string, schema: string | null) =>
    schema && schema !== 'public' && id.startsWith(`${schema}.`) ? id.slice(schema.length + 1) : id;
  const [name, setName] = useState(existing ? physicalOf(existing.id, existing.schema) : '');
  const [schema, setSchema] = useState<string | null>(existing?.schema ?? null);
  const [group, setGroup] = useState(existing?.group ?? defaultGroup);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [fields, setFields] = useState<EditField[]>(existing ? existing.columns.map(toEditField) : [DEFAULT_PK]);
  const [constraints, setConstraints] = useState<Constraint[]>(existing ? existing.constraints : [DEFAULT_PK_CONSTRAINT]);
  const [indexes, setIndexes] = useState<TableIndex[]>(existing ? existing.indexes : []);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('columns');

  // The identifier the Name field currently describes — re-qualified with the
  // selected schema. On create this IS the new table's id; on edit it's the
  // rename TARGET, compared against existing.id to decide whether Save also has
  // to rekey (see save()). Changing the Schema selector therefore renames the
  // table the same way changing the Name does — the id is `schema.name` for a
  // non-public schema, so it moves, and the rekey rides the same renameEntity path.
  // Normalised schema for id/edit logic (blank or "public" → null = the public
  // schema, which is never prefixed onto the id); the raw `schema` state backs
  // the input so mid-typing whitespace doesn't leak into the id.
  const schemaNorm = schema && schema.trim() && schema.trim() !== 'public' ? schema.trim() : null;
  const slug = slugify(name);
  const targetId = schemaNorm ? `${schemaNorm}.${slug}` : slug;
  // The id the upsert writes under: the table's CURRENT id (unchanged even
  // when the name field is mid-rename) — the rename is a separate edit applied
  // AFTER the upsert, so the content save never has to reason about the new id.
  const currentId = existing?.id ?? targetId;
  const willRename = isEdit && targetId !== existing!.id;

  // The exact upsertEntity edit Save would dispatch, built from the current
  // draft state — shared by the live validity check below AND save() itself,
  // so there is only ever ONE place that assembles this shape.
  const buildEdit = (): ModelEdit => ({
    kind: 'upsertEntity',
    entity: {
      id: currentId,
      label: currentId, // label is pinned to the identifier — the Name field IS the id
      group,
      description: description.trim() ? description.trim() : null,
      // The Schema field below owns this now (null = public). The upsert writes
      // it under the current id; if the schema changed, targetId changed too, so
      // save() also dispatches a renameEntity that moves the id to `schema.name`
      // — the two land the schema on both the field and the id.
      schema: schemaNorm,
      fields: fields.map((f) => ({
        name: f.name.trim(),
        type: f.type.trim(),
        title: f.title,
        description: f.description && f.description.trim() ? f.description.trim() : null,
        nullable: f.nullable,
        default: f.default,
        identity: f.identity,
        generated: f.generated,
      })),
      // The draft state <ConstraintsEditor/> owns below — not re-derived
      // from fields (see columns-grid.tsx's header comment for why that
      // used to be dangerous).
      constraints,
      // The draft state <IndexesEditor/> owns below — same reasoning as
      // constraints above: a brand-new table starts with none, an existing
      // one starts from its own current indexes.
      indexes,
    },
  });

  // In CREATE mode only, a slugified name colliding with an existing table's
  // id would silently overwrite it (upsertEntity is an upsert by design) —
  // this is the one blocking condition the engine itself has no way to
  // check (it doesn't know which id came from a fresh slugify vs. a real
  // edit), so it's still computed here, live, same as everything else below.
  // Renaming an existing table onto another table's id is the same hazard
  // (renameEntity would throw), so the collision check covers both.
  const idCollision = willRename ? model.entityById.has(targetId) : !isEdit && model.entityById.has(targetId);
  // The human-readable reason for idCollision, computed live so it can reach
  // the banner below before Save/Create is ever clicked — save() reuses this
  // exact string rather than re-deriving its own copy.
  const idCollisionError = idCollision ? `A table with id "${targetId}" already exists.` : null;
  // This component's own pre-dispatch column check (blank/duplicate names) —
  // kept as its own local rule (not just the engine's identical check inside
  // validateEditFields) so its message stays this component's own wording
  // ("field", matching the ColumnsGrid's own vocabulary) regardless of how
  // the engine phrases the same rule.
  const draftError = validateDraft(fields);

  // LIVE validity — every render, not just after a failed Save click (a
  // known-bad draft must block Save before the user ever presses it; see the
  // module header comment). Runs the exact edit Save would dispatch through
  // the engine's own synchronous validation and discards the result — this
  // is a pure check, nothing is mutated or dispatched. A `ModelEditError`
  // carries `.field`, the tab whose editor the user actually fixes it on —
  // this is the ONLY thing that decides which tab lights up red; no prose
  // is ever inspected (see apply-model-edit.ts's own header comment on
  // ModelEditError for why that used to misroute).
  let liveEngineError: ModelEditError | null = null;
  try {
    tryApplyModelEdit(model, buildEdit());
  } catch (err) {
    if (err instanceof ModelEditError) liveEngineError = err;
  }
  // The engine error's own message, captured alongside `.field` above — the
  // ONLY thing routing still keys on is `.field` (see the comment above); this
  // is purely so the banner below has words to show, not a second routing input.
  const liveError = liveEngineError?.message ?? null;

  const errorTab: TabId | null = draftError ? 'columns' : (liveEngineError?.field ?? null);
  const blocked = liveEngineError != null || draftError != null || idCollision || localError != null || ui.editError != null;
  // Frame 1e (design spec): Save visibly blocked must always come WITH A
  // REASON — `blocked` above disables Save/Create before any click, so
  // `localError`/`ui.editError` (only ever set from inside save(), post-
  // dispatch) are no longer sufficient on their own: a live-blocked draft
  // would show a disabled button and a red tab count but no explanation.
  // This is the SAME priority order save() below resolves the local checks
  // in (idCollision, then draftError), plus the live engine message, plus
  // the post-dispatch backstop.
  const bannerMessage = draftError ?? idCollisionError ?? liveError ?? localError ?? ui.editError;

  const save = () => {
    if (idCollision) {
      setLocalError(idCollisionError);
      return;
    }
    if (draftError) {
      setLocalError(draftError);
      return;
    }
    setLocalError(null);

    // Save the content FIRST (under the current id), then rekey with a
    // renameEntity edit — that order lets the rename fix the table's own
    // self-referencing fks, which the draft still spells with the OLD id, so
    // upsertEntity never has to reason about the pending new name.
    const edits: ModelEdit[] = [buildEdit()];
    if (willRename) edits.push({ kind: 'renameEntity', from: existing!.id, to: targetId });
    for (const edit of edits) actions.applyModelEdit(edit);
    try {
      // The reducer runs the identical pure edits but only reflects the outcome
      // on the NEXT render (dispatch is async) — re-run them here, synchronously
      // and in the same order, to decide whether to close now.
      let m = model;
      for (const edit of edits) m = tryApplyModelEdit(m, edit);
      onClose();
    } catch {
      // Invalid: ui.editError renders below on the next render; stay open.
      // (In practice `blocked` above already keeps Save disabled whenever
      // this would throw, so this is defense-in-depth, not the primary path.)
    }
  };

  const remove = () => {
    if (!id) return;
    actions.applyModelEdit({ kind: 'deleteEntity', id });
    actions.clearSelection();
    onClose();
  };

  // The error's own count (however many are queued behind the message that's
  // actually visible right now — always 1: draftError/liveEngineError only
  // ever hold a single message, not a list) replaces the tab's normal item count,
  // never the other way around — a red "1" must never be mistaken for "this
  // table has exactly one column".
  const tabCount = (id: TabId, itemCount: number) => (errorTab === id ? 1 : itemCount);
  const tabs: TabItem<TabId>[] = [
    { id: 'columns', label: 'Columns', count: tabCount('columns', fields.length), hasError: errorTab === 'columns' },
    { id: 'constraints', label: 'Constraints', count: tabCount('constraints', constraints.length), hasError: errorTab === 'constraints' },
    { id: 'indexes', label: 'Indexes', count: tabCount('indexes', indexes.length), hasError: errorTab === 'indexes' },
  ];

  const refs = id ? fkRefsTo(model, id) : [];

  return (
    <Modal title={isEdit ? `Edit ${existing!.label}` : 'New table'} onClose={onClose} size="wide">
      {bannerMessage && (
        <div className={errorRow}>
          <span>{bannerMessage}</span>
          <button
            type="button"
            className="shrink-0"
            onClick={() => (localError ? setLocalError(null) : actions.clearEditError())}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <label className={label}>
        Name
        <input className={field} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
      </label>

      <label className={label}>
        Schema
        <input
          className={field}
          value={schema ?? ''}
          placeholder="public"
          onChange={(e) => setSchema(e.target.value || null)}
        />
      </label>

      <label className={label}>
        Group
        <select className={field} value={group} onChange={(e) => setGroup(e.target.value)}>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className={label}>
        Description
        <textarea className={field} rows={2} value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />
      </label>

      {isEdit && <ColorRow model={model} id={existing!.id} colors={ui.colors} onChange={actions.setColors} />}

      <Tabs tabs={tabs} activeId={activeTab} onSelect={setActiveTab} idBase={TAB_ID_BASE} />

      {activeTab === 'columns' && (
        <div
          role="tabpanel"
          id={tabPanelId(TAB_ID_BASE, 'columns')}
          aria-labelledby={tabButtonId(TAB_ID_BASE, 'columns')}
          className={label}
        >
          <ColumnsGrid columns={fields} onChange={setFields} enums={model.enums} />
        </div>
      )}

      {activeTab === 'constraints' && (
        <div
          role="tabpanel"
          id={tabPanelId(TAB_ID_BASE, 'constraints')}
          aria-labelledby={tabButtonId(TAB_ID_BASE, 'constraints')}
          className={label}
        >
          <p className="text-2xs text-gray-400">A FOREIGN KEY is what draws an edge between two tables.</p>
          <ConstraintsEditor
            model={model}
            ownId={currentId}
            columns={fields.map((f) => f.name)}
            constraints={constraints}
            onChange={setConstraints}
          />
        </div>
      )}

      {activeTab === 'indexes' && (
        <div
          role="tabpanel"
          id={tabPanelId(TAB_ID_BASE, 'indexes')}
          aria-labelledby={tabButtonId(TAB_ID_BASE, 'indexes')}
          className={label}
        >
          <IndexesEditor columns={fields.map((f) => f.name)} indexes={indexes} onChange={setIndexes} />
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        {confirmingDelete && (
          <div className={cn('flex flex-col gap-2 rounded-md border border-red-700', 'bg-red-950 px-2 py-2 text-xs text-red-400')}>
            <span>
              {refs.length > 0
                ? `Deleting clears ${refs.length} reference field(s): ${refs.map((r) => `${r.entityId}.${r.field}`).join(', ')}.`
                : 'This cannot be undone.'}
            </span>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded px-2 py-1 text-gray-200 hover:bg-gray-800" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
              <button type="button" className="rounded bg-red-700 px-2 py-1 text-gray-50 hover:bg-red-600" onClick={remove}>
                Confirm delete
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="rounded-md border border-red-700 px-3 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-40"
            disabled={!isEdit}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </button>
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-gray-50 hover:bg-blue-500 disabled:opacity-50"
            disabled={!name.trim() || blocked}
            onClick={save}
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface ColorRowProps {
  model: Model;
  id: string;
  colors: ReadonlyMap<string, string>;
  onChange: (next: ReadonlyMap<string, string>) => void;
}

function ColorRow({ model, id, colors, onChange }: ColorRowProps) {
  const overridden = colors.has(id);
  const effective = entityColor(model, id, colors);
  const patch = (value: string | null) => {
    const next = new Map(colors);
    if (value === null) next.delete(id);
    else next.set(id, value);
    onChange(next);
  };
  return (
    <label className="flex items-center gap-2 text-xs text-gray-400">
      <input type="checkbox" checked={overridden} onChange={(e) => patch(e.target.checked ? effective : null)} />
      Override colour
      <input type="color" value={effective} disabled={!overridden} onChange={(e) => patch(e.target.value)} aria-label="Colour" />
    </label>
  );
}
