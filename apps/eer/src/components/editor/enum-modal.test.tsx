import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderDiagram } from '../../test/render';
import { EnumModal } from './enum-modal';

afterEach(cleanup);

// One referenced enum ('user_kind', used by users.kind) and one unreferenced
// enum ('spare') — enough to exercise the delete guard both ways.
function rawWithEnums() {
  return {
    groups: [{ id: 'g', label: 'G' }],
    enums: [
      { name: 'user_kind', values: ['human', 'agent'], schema: null },
      { name: 'spare', values: ['a'], schema: null },
    ],
    entities: [
      {
        id: 'users',
        group: 'g',
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'kind', type: 'user_kind' },
        ],
        constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }],
      },
    ],
  };
}

const addValue = (v: string) => {
  fireEvent.change(screen.getByLabelText('Add value'), { target: { value: v } });
  fireEvent.keyDown(screen.getByLabelText('Add value'), { key: 'Enter' });
};

describe('EnumModal', () => {
  it('create dispatches one upsertEnum with the entered name + values (public schema)', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<EnumModal onClose={onClose} />, rawWithEnums());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'status' } });
    addValue('open');
    addValue('closed');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ kind: 'upsertEnum', enum: { name: 'status', values: ['open', 'closed'], schema: null } });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('carries a non-public schema through on create', async () => {
    const { actions } = await renderDiagram(<EnumModal onClose={() => {}} />, rawWithEnums());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'kind' } });
    fireEvent.change(screen.getByLabelText('Schema'), { target: { value: 'billing' } });
    addValue('x');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(spy).toHaveBeenCalledWith({ kind: 'upsertEnum', enum: { name: 'kind', values: ['x'], schema: 'billing' } });
  });

  it('blocks Save with a message when the enum has no values', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<EnumModal onClose={onClose} />, rawWithEnums());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'empty' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText(/at least one value/)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('blocks creating an enum whose name collides with an existing one', async () => {
    const { actions } = await renderDiagram(<EnumModal onClose={() => {}} />, rawWithEnums());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'user_kind' } });
    addValue('x');
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText(/already exists/)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('renaming an existing enum dispatches renameEnum then upsertEnum', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<EnumModal name="user_kind" onClose={onClose} />, rawWithEnums());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'actor_kind' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(spy.mock.calls[0]![0]).toEqual({ kind: 'renameEnum', from: 'user_kind', to: 'actor_kind' });
    expect(spy.mock.calls[1]![0]).toEqual({ kind: 'upsertEnum', enum: { name: 'actor_kind', values: ['human', 'agent'], schema: null } });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('refuses to delete an enum still used by a column, naming the dependent', async () => {
    await renderDiagram(<EnumModal name="user_kind" onClose={() => {}} />, rawWithEnums());
    const del = screen.getByRole('button', { name: 'Delete' });
    expect(del).toBeDisabled();
    expect(del.title).toMatch(/users\.kind/);
  });

  it('deletes an unreferenced enum', async () => {
    const onClose = vi.fn();
    const { actions } = await renderDiagram(<EnumModal name="spare" onClose={onClose} />, rawWithEnums());
    const spy = vi.spyOn(actions, 'applyModelEdit');

    const del = screen.getByRole('button', { name: 'Delete' });
    expect(del).not.toBeDisabled();
    fireEvent.click(del);

    expect(spy).toHaveBeenCalledWith({ kind: 'deleteEnum', name: 'spare' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
