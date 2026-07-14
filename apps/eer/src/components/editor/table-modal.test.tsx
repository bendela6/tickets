import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyModelEdit, type ModelEdit } from '../../engine/model/apply-model-edit';
import { loadModel } from '../../engine/model/load-model';
import { serializeModel } from '../../engine/model/serialize-model';
import { useDiagramUi } from '../../state/diagram-context';
import type { DiagramUi } from '../../state/diagram-reducer';
import { buildModel, twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { TableModal } from './table-modal';
import seedRaw from '../../../models/items-platform.json';

afterEach(cleanup);

// Surfaces ui.colors alongside <TableModal/> so the override test can assert
// the reducer's actual state rather than a spy — vi.spyOn(actions, 'setColors')
// after render wouldn't be seen by a handler prop that already captured the
// pre-spy function reference at render time (same idiom model-modal.test.tsx
// uses for ui.modelId via its own Probe).
let uiRef: DiagramUi | null = null;
function Probe() {
  uiRef = useDiagramUi();
  return null;
}

describe('TableModal', () => {
  it('renders a row per existing field', async () => {
    // twoZoneRaw's "orders": id (pk), users_id (fk -> users), tag_id (fk -> tags).
    await renderDiagram(<TableModal id="orders" onClose={() => {}} />, twoZoneRaw());

    expect((screen.getByLabelText('Column 1 name') as HTMLInputElement).value).toBe('id');
    expect((screen.getByLabelText('Column 2 name') as HTMLInputElement).value).toBe('users_id');
    expect((screen.getByLabelText('Column 3 name') as HTMLInputElement).value).toBe('tag_id');
    expect(screen.queryByLabelText('Column 4 name')).not.toBeInTheDocument();
  });

  // The columns grid has no Role / Ref-table / Ref-field columns any more —
  // keys and references are authored separately, by <ConstraintsEditor/>
  // (see columns-grid.tsx's header comment).
  it('has no role or reference-table controls in the columns grid', async () => {
    await renderDiagram(<TableModal id="users" onClose={() => {}} />, twoZoneRaw());
    expect(screen.queryByLabelText('Column 2 role')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Column 2 reference table')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Column 2 reference field')).not.toBeInTheDocument();
  });

  it('Add column + Save dispatches ONE upsertEntity whose fields include the new row', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="tags" onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
    fireEvent.change(screen.getByLabelText('Column 2 name'), { target: { value: 'label' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]!;
    expect(edit).toMatchObject({ kind: 'upsertEntity', entity: { id: 'tags' } });
    expect((edit as { entity: { fields: unknown[] } }).entity.fields).toEqual([
      // "int" normalises to drizzle-canonical "integer" on load (see pg-types).
      { name: 'id', type: 'integer', title: null, description: null, nullable: true, default: null, identity: null, generated: null },
      { name: 'label', type: 'text', title: null, description: null, nullable: true, default: null, identity: null, generated: null },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('adds a column with a picked type, nullable and default, and saves them', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="users" onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

    const rows = screen.getAllByLabelText(/^Column \d+ name$/);
    const i = rows.length; // the new row is the last one, 1-indexed labels
    fireEvent.change(screen.getByLabelText(`Column ${i} name`), { target: { value: 'note' } });

    const typeSelects = screen.getAllByLabelText('type');
    fireEvent.change(typeSelects[i - 1]!, { target: { value: 'varchar' } });
    const params = screen.getAllByLabelText('type parameter 1');
    fireEvent.change(params[params.length - 1]!, { target: { value: '64' } });

    fireEvent.click(screen.getByLabelText(`Column ${i} nullable`)); // ticked by default → untick
    fireEvent.change(screen.getByLabelText(`Column ${i} default`), { target: { value: "'draft'" } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]!;
    expect((edit as { entity: { fields: unknown[] } }).entity.fields.at(-1)).toEqual({
      name: 'note',
      type: 'varchar(64)',
      nullable: false,
      default: "'draft'",
      title: null,
      description: null,
      identity: null,
      generated: null,
    });
  });

  // CRITICAL 2, case (c): Save must carry the entity's OWN current constraints
  // through unchanged — never re-derive them from fields (there's no UI left
  // to do that from) — or a description-only edit on a real constraints-
  // authored table would silently drop its keys and every edge attached to it.
  it('a Save of an existing table dispatches an upsertEntity whose constraints deep-equal the entity\'s current constraints', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="orders" onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]!;
    const current = buildModel(twoZoneRaw()).entityById.get('orders')!;
    expect((edit as { entity: { constraints: unknown } }).entity.constraints).toEqual(current.constraints);
    expect((edit as { entity: { indexes: unknown } }).entity.indexes).toEqual(current.indexes);
  });

  it('duplicate field names block Save with a visible message and do not dispatch', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="tags" onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
    fireEvent.change(screen.getByLabelText('Column 2 name'), { target: { value: 'id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Duplicate field name/)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('delete confirm lists the referencing fields, then dispatches deleteEntity + clearSelection', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="users" onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');
    const clearSpy = vi.spyOn(actions, 'clearSelection');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/orders\.users_id/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(spy).toHaveBeenCalledWith({ kind: 'deleteEntity', id: 'users' });
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the colour override checkbox writes and removes the entity key in the colours map', async () => {
    await renderDiagram(
      <>
        <Probe />
        <TableModal id="users" onClose={() => {}} />
      </>,
      twoZoneRaw(),
    );

    // The columns grid now has its own per-row "nullable" checkboxes, so the
    // colour override checkbox needs a name to disambiguate.
    const checkbox = screen.getByRole('checkbox', { name: /override colour/i });
    expect(checkbox).not.toBeChecked();
    expect(uiRef?.colors.has('users')).toBe(false);

    fireEvent.click(checkbox);
    expect(uiRef?.colors.has('users')).toBe(true);
    expect(screen.getByLabelText('Colour')).not.toBeDisabled();

    fireEvent.click(checkbox);
    expect(uiRef?.colors.has('users')).toBe(false);
  });

  it('renders a "New table" title and a default pk field in create mode', async () => {
    await renderDiagram(<TableModal onClose={() => {}} />, twoZoneRaw());

    expect(screen.getByText('New table')).toBeInTheDocument();
    expect((screen.getByLabelText('Column 1 name') as HTMLInputElement).value).toBe('id');
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('create mode blocks Save with a visible message when the slugified id collides with an existing table', async () => {
    // upsertEntity is an upsert — creating "Users" (slug "users") while "users"
    // already exists would silently clobber it without this guard.
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText(/A table with id "users" already exists/)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  // Create mode's brand-new table gets exactly one default pk constraint on
  // its default `id` field, and no indexes — the one constraint the editor
  // still authors itself, since a fresh table needs SOME key to exist at all.
  it('create mode dispatches an upsertEntity with a default id-pk constraint and no indexes', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Shipments' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]!;
    expect((edit as { entity: { constraints: unknown } }).entity.constraints).toEqual([
      { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
    ]);
    expect((edit as { entity: { indexes: unknown } }).entity.indexes).toEqual([]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Reviewer-found silent data loss: toEditField dropped `title`, and
  // upsertEntity hard-wrote `title: null` for every field, so a no-op Save
  // destroyed all 140 titled fields the real seed has. This exercises the
  // exact round trip the UI does — toEditField -> upsertEntity edit ->
  // applyModelEdit -> serializeModel -> load — against the real bundled seed,
  // not a trimmed fixture, so it can't drift unnoticed as the seed grows.
  it('a no-op Save preserves title/description byte-identically, and preserves the entity\'s constraints/relationship (real seed, outbox)', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="outbox" onClose={onClose} />, seedRaw);
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]!;

    const before = loadModel(seedRaw).model!;
    const beforeEntity = before.entityById.get('outbox')!;
    const originalField = beforeEntity.columns.find((f) => f.name === 'event_id')!;
    // Sanity: this is genuinely the titled shape the fix targets, and the
    // legacy role:'pk'+ref:'events' the raw file carries for this column has
    // synthesized into a real pk constraint AND a real fk constraint (a
    // shared-primary-key reference) — not stored on the Column itself any
    // more (see types.ts / load-model's synthesizeLegacyConstraints).
    expect(originalField).toMatchObject({ title: 'Event', description: 'Event to deliver.' });
    expect(beforeEntity.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'pk', columns: ['event_id'] }),
        expect.objectContaining({ kind: 'fk', columns: ['event_id'], refTable: 'events' }),
      ]),
    );
    const beforeRel = before.relationships.find((r) => r.target === 'outbox' && r.targetField === 'event_id')!;
    expect(beforeRel).toBeDefined();

    const applied = applyModelEdit(before, edit as ModelEdit);
    const appliedEntity = applied.entityById.get('outbox')!;
    // title/description survive; the entity's constraints (and therefore the
    // derived relationship for event_id -> events) are carried through
    // verbatim rather than re-derived from fields.
    expect(appliedEntity.columns.find((f) => f.name === 'event_id')!.title).toBe('Event');
    expect(appliedEntity.constraints).toEqual(beforeEntity.constraints);
    expect(applied.relationships.some((r) => r.id === beforeRel.id)).toBe(true);

    const raw2 = serializeModel(applied, before.colors);
    const { model: reloaded, errors } = loadModel(raw2);
    expect(errors).toEqual([]);
    expect(reloaded!.entityById.get('outbox')!.columns.find((f) => f.name === 'event_id')!.title).toBe('Event');
    expect(reloaded!.relationships.some((r) => r.id === beforeRel.id)).toBe(true);

    // Every other field on the entity (plain, titled, no ref) survives too.
    const otherNames = ['created_at', 'picked_at', 'done_at'];
    for (const name of otherNames) {
      const orig = beforeEntity.columns.find((f) => f.name === name)!;
      const reloadedField = reloaded!.entityById.get('outbox')!.columns.find((f) => f.name === name)!;
      expect(reloadedField.title).toBe(orig.title);
      expect(reloadedField.description).toBe(orig.description);
    }
  });

  // The centrepiece payoff: a FOREIGN KEY authored through the ConstraintsEditor
  // (wired into this modal under the columns grid) is now the ONLY way to draw
  // an edge between two tables — this exercises the whole path, from clicking
  // "+ FK" through Save's dispatched upsertEntity, to the derived relationship
  // (deriveRelationships) an edge is drawn from.
  it('adding an FK constraint through the modal and saving dispatches it, and the model derives an edge for it', async () => {
    // "tags" (twoZoneRaw): just an `id` pk, no fk of its own — a clean slate.
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="tags" onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
    fireEvent.change(screen.getByLabelText('Column 2 name'), { target: { value: 'owner_id' } });

    // Task 10: the constraints editor now only mounts while its own tab is
    // active — the "+ FK" button doesn't exist in the DOM until then.
    fireEvent.click(screen.getByRole('tab', { name: /constraints/i }));

    // tags already carries a synthesized `c1` pk constraint, so the new fk
    // added here lands at index 1 — "Constraint 2".
    fireEvent.click(screen.getByRole('button', { name: '+ FK' }));
    fireEvent.click(screen.getByLabelText('Constraint 2 column owner_id'));
    fireEvent.change(screen.getByLabelText('Constraint 2 target table'), { target: { value: 'users' } });
    fireEvent.click(screen.getByLabelText('Constraint 2 target column id'));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]! as [ModelEdit];
    const entity = (edit as { entity: { constraints: unknown[] } }).entity;
    expect(entity.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'fk', columns: ['owner_id'], refTable: 'users', refColumns: ['id'] }),
      ]),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    // The user-visible payoff: applying that same edit against the model
    // derives a real relationship users.id -> tags.owner_id — an edge.
    const before = buildModel(twoZoneRaw());
    const applied = applyModelEdit(before, edit);
    const rel = applied.relationships.find((r) => r.target === 'tags' && r.targetField === 'owner_id');
    expect(rel).toBeDefined();
    expect(rel).toMatchObject({ source: 'users', sourceField: 'id', kind: 'fk' });
  });

  // Task 8: the indexes editor is wired into the modal under the constraints
  // editor, and — unlike the earlier verbatim passthrough — a Save must now
  // dispatch whatever <IndexesEditor/> produced.
  it('adding an index through the modal and saving dispatches the indexes the editor produced', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="tags" onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    // Task 10: the indexes editor now only mounts while its own tab is
    // active — "add index" doesn't exist in the DOM until then.
    fireEvent.click(screen.getByRole('tab', { name: /indexes/i }));
    fireEvent.click(screen.getByRole('button', { name: /add index/i }));
    fireEvent.change(screen.getByLabelText('Index 1 name'), { target: { value: 'idx_tags_id' } });
    fireEvent.click(screen.getByLabelText('Index 1 column id'));
    fireEvent.click(screen.getByLabelText('Index 1 unique'));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]!;
    expect((edit as { entity: { indexes: unknown[] } }).entity.indexes).toEqual([
      {
        id: 'i1', name: 'idx_tags_id', unique: true, method: null, only: false, where: null,
        columns: [{ expression: 'id', isExpression: false, order: null, nulls: null, opClass: null }],
      },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Reviewer-carried finding from the constraints editor task: no test round-
  // tripped a CHECK constraint or a COMPOSITE UNIQUE through the modal, and
  // the engine does no kind-specific filtering — so it *should* just work,
  // but that's exactly the class of bug that has bitten this project twice
  // (see the "no-op Save preserves title" test above). This fixture carries
  // every kind at once — a composite PK, a composite UNIQUE with the OPPOSITE
  // column order (proving order isn't silently normalized), a CHECK, an FK
  // with ON DELETE CASCADE, and an index — on one entity, opens it in the
  // real modal, changes only the description, and proves the dispatched edit
  // — and the model that edit produces — carry every one of them unchanged.
  function richRaw() {
    return {
      groups: [{ id: 'z', label: 'Zone', order: 0 }],
      entities: [
        { id: 'parent', group: 'z', fields: [{ name: 'id', type: 'int' }] },
        {
          id: 'child',
          group: 'z',
          description: 'original description',
          fields: [
            { name: 'a', type: 'int' },
            { name: 'b', type: 'int' },
            { name: 'parent_id', type: 'int' },
          ],
          constraints: [
            { id: 'c1', kind: 'pk', name: null, columns: ['a', 'b'] },
            { id: 'c2', kind: 'unique', name: 'uq_b_a', columns: ['b', 'a'] },
            { id: 'c3', kind: 'check', name: 'ck_a_positive', expression: 'a > 0' },
            {
              id: 'c4',
              kind: 'fk',
              name: null,
              columns: ['parent_id'],
              refTable: 'parent',
              refColumns: ['id'],
              onDelete: 'cascade',
              onUpdate: null,
            },
          ],
          indexes: [{ id: 'i1', name: 'idx_child_b', columns: ['b'], unique: false }],
        },
      ],
    };
  }

  it('a description-only Save preserves a composite PK, a composite UNIQUE (order significant), a CHECK, an FK with ON DELETE CASCADE, and an index — deep-equal, through the real modal', async () => {
    const raw = richRaw();
    const model = buildModel(raw);
    const before = model.entityById.get('child')!;
    // Sanity: this really is the rich, every-kind-at-once shape the test needs.
    expect(before.constraints).toEqual([
      { id: 'c1', kind: 'pk', name: null, columns: ['a', 'b'] },
      { id: 'c2', kind: 'unique', name: 'uq_b_a', columns: ['b', 'a'], nullsNotDistinct: false },
      { id: 'c3', kind: 'check', name: 'ck_a_positive', expression: 'a > 0' },
      {
        id: 'c4', kind: 'fk', name: null, columns: ['parent_id'], refSchema: null,
        refTable: 'parent', refColumns: ['id'], onDelete: 'cascade', onUpdate: null,
      },
    ]);
    expect(before.indexes).toEqual([
      {
        id: 'i1', name: 'idx_child_b', unique: false, method: null, only: false, where: null,
        columns: [{ expression: 'b', isExpression: false, order: null, nulls: null, opClass: null }],
      },
    ]);

    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="child" onClose={onClose} />, raw);
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'updated description' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]! as [ModelEdit];
    const dispatched = (edit as { entity: { description: unknown; constraints: unknown; indexes: unknown } }).entity;
    expect(dispatched.description).toBe('updated description');
    expect(dispatched.constraints).toEqual(before.constraints);
    expect(dispatched.indexes).toEqual(before.indexes);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Not just the dispatched payload — genuinely run it through the engine
    // too, so a bug in upsertEntity's own handling of these shapes (as
    // distinct from the modal's) can't hide behind an untested edit object.
    const applied = applyModelEdit(model, edit);
    const appliedEntity = applied.entityById.get('child')!;
    expect(appliedEntity.description).toBe('updated description');
    expect(appliedEntity.constraints).toEqual(before.constraints);
    expect(appliedEntity.indexes).toEqual(before.indexes);
  });

  // Task 10: the modal is now tabbed (Columns / Constraints / Indexes), each
  // with its own draft-owning panel, but the draft state itself still lives
  // in TableModalForm (not the tabs) — so switching tabs must never lose an
  // edit typed into a field the user just left.
  describe('tabs', () => {
    it('keeps an unsaved column-name edit when switching away to another tab and back', async () => {
      await renderDiagram(<TableModal id="users" onClose={() => {}} />, twoZoneRaw());

      fireEvent.change(screen.getByLabelText('Column 1 name'), { target: { value: 'id_x' } });
      fireEvent.click(screen.getByRole('tab', { name: /constraints/i }));
      fireEvent.click(screen.getByRole('tab', { name: /columns/i }));

      expect((screen.getByLabelText('Column 1 name') as HTMLInputElement).value).toBe('id_x');
    });

    it('shows only the active tab\'s panel, switching which editor is mounted', async () => {
      await renderDiagram(<TableModal id="tags" onClose={() => {}} />, twoZoneRaw());

      expect(screen.getByRole('tab', { name: /columns/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByRole('button', { name: '+ FK' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /constraints/i }));
      expect(screen.getByRole('tab', { name: /constraints/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('button', { name: '+ FK' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Column 1 name')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /indexes/i }));
      expect(screen.getByRole('button', { name: /add index/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '+ FK' })).not.toBeInTheDocument();
    });

    // The load-bearing behaviour: a validation error must be visible on the
    // tab that owns it even while a DIFFERENT tab is active, so it can't hide
    // from the user. Duplicate column names are this component's own
    // pre-dispatch check (validateDraft) — the Columns tab's case.
    it('surfaces a red error count on the Columns tab, visible even while Constraints is active, and disables Save', async () => {
      const onClose = vi.fn();
      await renderDiagram(<TableModal id="tags" onClose={onClose} />, twoZoneRaw());

      fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
      fireEvent.change(screen.getByLabelText('Column 2 name'), { target: { value: 'id' } }); // duplicates Column 1's "id"
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText(/Duplicate field name/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /constraints/i }));

      const columnsTab = screen.getByRole('tab', { name: /columns/i });
      expect(columnsTab).toHaveTextContent('1');
      expect(columnsTab).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
    });

    // The Constraints-tab half of the same wiring: this time the blocking
    // error comes from the ENGINE's own upsertEntity validation (surfaced via
    // ui.editError), not this component's local validateDraft — an
    // incomplete FK (no columns picked yet) is rejected before it ever
    // reaches the model.
    it('surfaces a red error count on the Constraints tab when the engine rejects an incomplete FK', async () => {
      const onClose = vi.fn();
      await renderDiagram(<TableModal id="tags" onClose={onClose} />, twoZoneRaw());

      fireEvent.click(screen.getByRole('tab', { name: /constraints/i }));
      fireEvent.click(screen.getByRole('button', { name: '+ FK' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText(/must reference at least one column/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /indexes/i }));

      const constraintsTab = screen.getByRole('tab', { name: /constraints/i });
      expect(constraintsTab).toHaveTextContent('1');
      expect(constraintsTab).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
