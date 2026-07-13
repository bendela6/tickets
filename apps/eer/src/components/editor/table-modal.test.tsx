import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDiagramUi } from '../../state/diagram-context';
import type { DiagramUi } from '../../state/diagram-reducer';
import { twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { TableModal } from './table-modal';

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
      { name: 'id', type: 'int', role: 'pk', ref: null, refField: null, description: null },
      { name: 'label', type: 'text', role: null, ref: null, refField: null, description: null },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
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
});
