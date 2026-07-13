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

    expect((screen.getByLabelText('Field 1 name') as HTMLInputElement).value).toBe('id');
    expect((screen.getByLabelText('Field 2 name') as HTMLInputElement).value).toBe('users_id');
    expect((screen.getByLabelText('Field 3 name') as HTMLInputElement).value).toBe('tag_id');
    expect(screen.queryByLabelText('Field 4 name')).not.toBeInTheDocument();
  });

  // The field grid has no Role / Ref-table / Ref-field columns any more — keys
  // and references come from the table's constraints, not editable here yet
  // (see field-grid.tsx's header comment).
  it('has no role or reference-table controls in the field grid', async () => {
    await renderDiagram(<TableModal id="users" onClose={() => {}} />, twoZoneRaw());
    expect(screen.queryByLabelText('Field 2 role')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Field 2 reference table')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Field 2 reference field')).not.toBeInTheDocument();
  });

  it('Add field + Save dispatches ONE upsertEntity whose fields include the new row', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="tags" onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
    fireEvent.change(screen.getByLabelText('Field 2 name'), { target: { value: 'label' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]!;
    expect(edit).toMatchObject({ kind: 'upsertEntity', entity: { id: 'tags' } });
    expect((edit as { entity: { fields: unknown[] } }).entity.fields).toEqual([
      { name: 'id', type: 'int', title: null, description: null, nullable: true, default: null },
      { name: 'label', type: 'text', title: null, description: null, nullable: true, default: null },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
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

    fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
    fireEvent.change(screen.getByLabelText('Field 2 name'), { target: { value: 'id' } });
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

    const checkbox = screen.getByRole('checkbox');
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
    expect((screen.getByLabelText('Field 1 name') as HTMLInputElement).value).toBe('id');
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
});
