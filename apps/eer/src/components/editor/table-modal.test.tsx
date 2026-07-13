import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyModelEdit, type ModelEdit } from '../../engine/model/apply-model-edit';
import { loadModel } from '../../engine/model/load-model';
import { serializeModel } from '../../engine/model/serialize-model';
import { useDiagramUi } from '../../state/diagram-context';
import type { DiagramUi } from '../../state/diagram-reducer';
import { twoZoneRaw } from '../../test/models';
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

  it('role -> FK enables the ref selects, and picking a ref populates ref-field options', async () => {
    await renderDiagram(<TableModal id="users" onClose={() => {}} />, twoZoneRaw());

    // "users" field 2 is "name", a plain field with no role yet.
    const roleSelect = screen.getByLabelText('Field 2 role') as HTMLSelectElement;
    const refTable = screen.getByLabelText('Field 2 reference table') as HTMLSelectElement;
    const refField = screen.getByLabelText('Field 2 reference field') as HTMLSelectElement;

    expect(refTable).toBeDisabled();
    expect(refField).toBeDisabled();

    fireEvent.change(roleSelect, { target: { value: 'fk' } });
    expect(refTable).not.toBeDisabled();
    expect(refField).toBeDisabled(); // no ref picked yet

    fireEvent.change(refTable, { target: { value: 'orders' } });
    expect(refField).not.toBeDisabled();

    const optionValues = Array.from(refField.options).map((o) => o.value);
    expect(optionValues).toEqual(expect.arrayContaining(['id', 'users_id', 'tag_id']));
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
      { name: 'id', type: 'int', role: 'pk', ref: null, refField: null, title: null, description: null },
      { name: 'label', type: 'text', role: null, ref: null, refField: null, title: null, description: null },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('an fk row with ref set and refField left null saves successfully (refField defaults to "id")', async () => {
    // Regression: the seed fixtures always set refField explicitly, so nothing
    // previously exercised apply-model-edit's `f.refField ?? 'id'` default via
    // this form. "orders" has a plain "id" field on its ref target ("tags"),
    // so leaving Field 3's ref-field unset must still resolve and save clean.
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="orders" onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    // Field 3 ("tag_id") already has ref="tags", refField="id" from the fixture
    // — clear refField back to unset ("–") without touching ref or role.
    fireEvent.change(screen.getByLabelText('Field 3 reference field'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]!;
    expect((edit as { entity: { fields: { name: string; ref: string | null; refField: string | null }[] } }).entity.fields).toContainEqual(
      expect.objectContaining({ name: 'tag_id', ref: 'tags', refField: null }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/references unknown field/)).not.toBeInTheDocument();
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

  // Reviewer-found silent data loss (two Importants): (1) toEditField dropped
  // `title`, and upsertEntity hard-wrote `title: null` for every field, so a
  // no-op Save destroyed all 140 titled fields the real seed has. (2) the save
  // mapping stripped `ref`/`refField` for any non-'fk'-role field, so the
  // seed's outbox.event_id (role 'pk', ref 'events' — a shared-pk identifying
  // reference) lost its ref on every save. This exercises the exact round trip
  // the UI does — toEditField -> upsertEntity edit -> applyModelEdit ->
  // serializeModel -> load — against the real bundled seed, not a trimmed
  // fixture, so it can't drift unnoticed as the seed grows.
  it('a no-op Save preserves title/ref/refField/description byte-identically (real seed, outbox.event_id)', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<TableModal id="outbox" onClose={onClose} />, seedRaw);
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(1);
    const [edit] = spy.mock.calls[0]!;

    const before = loadModel(seedRaw).model!;
    const originalField = before.entityById.get('outbox')!.fields.find((f) => f.name === 'event_id')!;
    // Sanity: this is genuinely the role-pk-with-ref, titled shape the fix targets.
    expect(originalField).toMatchObject({ role: 'pk', ref: 'events', title: 'Event', description: 'Event to deliver.' });

    const applied = applyModelEdit(before, edit as ModelEdit);
    const appliedField = applied.entityById.get('outbox')!.fields.find((f) => f.name === 'event_id')!;
    expect(appliedField).toEqual(originalField);

    const raw2 = serializeModel(applied, before.colors);
    const { model: reloaded, errors } = loadModel(raw2);
    expect(errors).toEqual([]);
    const reloadedField = reloaded!.entityById.get('outbox')!.fields.find((f) => f.name === 'event_id')!;
    // serializeModel fills a null refField in with its "id" default when `ref`
    // is set (see its own comment) — the only field this round trip is
    // expected to normalize; everything else, title/ref/role/description
    // included, must come back exactly as it was.
    expect(reloadedField).toEqual({ ...originalField, refField: 'id' });

    // Every other field on the entity (plain, titled, no ref) survives too.
    const otherNames = ['created_at', 'picked_at', 'done_at'];
    for (const name of otherNames) {
      const orig = before.entityById.get('outbox')!.fields.find((f) => f.name === name)!;
      expect(reloaded!.entityById.get('outbox')!.fields.find((f) => f.name === name)).toEqual(orig);
    }
  });
});
