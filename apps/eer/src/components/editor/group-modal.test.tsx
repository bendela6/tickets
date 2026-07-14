import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pkField, twoZoneRaw } from '../../test/models';
import { renderDiagram } from '../../test/render';
import { GroupModal } from './group-modal';

afterEach(cleanup);

// z1 has one member ("users"), z2 has two ("orders", "tags"); neither is empty
// — an extra, deletable "empty" zone is needed for the delete-enabled case.
function withEmptyGroupRaw() {
  return {
    groups: [
      { id: 'z1', label: 'Zone One', order: 0 },
      { id: 'empty', label: 'Empty Zone', order: 1 },
    ],
    entities: [{ id: 'a', group: 'z1', fields: [pkField] }],
    relationships: [],
  };
}

describe('GroupModal', () => {
  it('create dispatches upsertGroup with a slugified id', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<GroupModal onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Zone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(spy).toHaveBeenCalledWith({
      kind: 'upsertGroup',
      group: { id: 'new-zone', label: 'New Zone', parent: null },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('picking a Parent makes the new group a subgroup; there is no separate kind control', async () => {
    const { actions } = await renderDiagram(<GroupModal onClose={() => {}} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');
    // The only thing that makes a group a subgroup is choosing a parent — there
    // is no Zone/Subgroup radio any more.
    expect(screen.queryByText('Kind')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Nested' } });
    fireEvent.change(screen.getByLabelText('Parent group'), { target: { value: 'z1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(spy).toHaveBeenCalledWith({
      kind: 'upsertGroup',
      group: { id: 'nested', label: 'Nested', parent: 'z1' },
    });
  });

  it('delete is disabled with the blocking reason in its title when the group has tables', async () => {
    await renderDiagram(<GroupModal id="z2" onClose={() => {}} />, twoZoneRaw());

    const del = screen.getByRole('button', { name: 'Delete' });
    expect(del).toBeDisabled();
    expect(del.title).toMatch(/2 table/);
  });

  it('delete is enabled and dispatches deleteGroup when the group is empty', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<GroupModal id="empty" onClose={onClose} />, withEmptyGroupRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    const del = screen.getByRole('button', { name: 'Delete' });
    expect(del).not.toBeDisabled();
    fireEvent.click(del);

    expect(spy).toHaveBeenCalledWith({ kind: 'deleteGroup', id: 'empty' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the id read-only when editing an existing group', async () => {
    await renderDiagram(<GroupModal id="z1" onClose={() => {}} />, twoZoneRaw());
    const idField = screen.getByLabelText('Id') as HTMLInputElement;
    expect(idField.value).toBe('z1');
    expect(idField).toBeDisabled();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Zone One');
  });

  it('editing an existing group renames it in place, keeping its original id', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<GroupModal id="z1" onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Zone One Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spy).toHaveBeenCalledWith({
      kind: 'upsertGroup',
      group: { id: 'z1', label: 'Zone One Renamed', parent: null },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('create mode blocks Save with a dismissible message when the slugified id collides with an existing group', async () => {
    // upsertGroup is an upsert — creating a group named exactly "z1" (an
    // existing zone id) would silently clobber it without this guard. Before
    // the guard existed, this same input instead reached apply-model-edit's
    // "cannot be its own parent" check via a self-referencing parent select
    // (still covered directly at the engine level by apply-model-edit.test.ts)
    // — the collision guard now fires first, with a more accurate message.
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<GroupModal onClose={onClose} />, twoZoneRaw());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'z1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText(/A group with id "z1" already exists/)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss error'));
    expect(screen.queryByText(/A group with id "z1" already exists/)).not.toBeInTheDocument();
  });
});
