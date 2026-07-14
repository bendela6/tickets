import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildModel } from '../../test/models';
import { EnumsEditor } from './enums-editor';

afterEach(cleanup);

// Same fixture shape as apply-model-edit.test.ts's rawWithEnum (Task 3's
// engine tests): one enum ('user_kind') used by two columns on `users` — a
// plain column and an array column — so a single fixture exercises both
// enumRefsTo's dependents list AND renameEnum's array-preserving rewrite.
function rawWithEnum() {
  return {
    groups: [{ id: 'g', label: 'G' }],
    enums: [{ name: 'user_kind', values: ['human', 'agent'], schema: null }],
    entities: [
      {
        id: 'users',
        label: 'Users',
        group: 'g',
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'kind', type: 'user_kind' },
          { name: 'kinds', type: 'user_kind[]' },
        ],
        constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }],
      },
    ],
  };
}

const setup = () => {
  const model = buildModel(rawWithEnum());
  const onApplyEdit = vi.fn();
  render(<EnumsEditor model={model} onApplyEdit={onApplyEdit} />);
  return { model, onApplyEdit };
};

describe('EnumsEditor', () => {
  it('renders one card per model enum with numbered value chips in DDL order', () => {
    setup();
    const name = screen.getByLabelText('Enum 1 name') as HTMLInputElement;
    expect(name.value).toBe('user_kind');
    const humanChip = screen.getByText('human').closest('div')!;
    const agentChip = screen.getByText('agent').closest('div')!;
    expect(humanChip.textContent).toContain('1');
    expect(agentChip.textContent).toContain('2');
  });

  it('commits a rename on blur, not per keystroke', () => {
    const { onApplyEdit } = setup();
    const name = screen.getByLabelText('Enum 1 name');
    fireEvent.change(name, { target: { value: 'actor_kind' } });
    expect(onApplyEdit).not.toHaveBeenCalled();
    fireEvent.blur(name);
    expect(onApplyEdit).toHaveBeenCalledWith({ kind: 'renameEnum', from: 'user_kind', to: 'actor_kind' });
  });

  it('does not dispatch when the name is unchanged on blur', () => {
    const { onApplyEdit } = setup();
    const name = screen.getByLabelText('Enum 1 name');
    fireEvent.focus(name);
    fireEvent.blur(name);
    expect(onApplyEdit).not.toHaveBeenCalled();
  });

  it('reverts (rather than dispatches) a blank rename of an existing enum', () => {
    const { onApplyEdit } = setup();
    const name = screen.getByLabelText('Enum 1 name') as HTMLInputElement;
    fireEvent.change(name, { target: { value: '  ' } });
    fireEvent.blur(name);
    expect(onApplyEdit).not.toHaveBeenCalled();
    expect(name.value).toBe('user_kind');
  });

  it('refuses to delete an enum in use, names the dependents in red mono, and does not dispatch', () => {
    const { onApplyEdit } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete enum user_kind' }));
    expect(onApplyEdit).not.toHaveBeenCalled();
    const msg = screen.getByText(/users\.kind/);
    expect(msg.textContent).toMatch(/users\.kind, users\.kinds/);
    expect(msg.className).toMatch(/text-red-400/);
    expect(msg.className).toMatch(/font-mono/);
    // The enum itself is untouched — still one card, still named user_kind.
    expect(screen.getAllByLabelText(/Enum \d+ name/)).toHaveLength(1);
  });

  it('deletes an enum no column references', () => {
    const { onApplyEdit } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ add enum' }));
    const name2 = screen.getByLabelText('Enum 2 name');
    fireEvent.change(name2, { target: { value: 'order_status' } });
    fireEvent.blur(name2);
    onApplyEdit.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Delete enum order_status' }));
    expect(onApplyEdit).toHaveBeenCalledWith({ kind: 'deleteEnum', name: 'order_status' });
    expect(screen.getAllByLabelText(/Enum \d+ name/)).toHaveLength(1);
  });

  it('a brand-new, never-named row is a pure local discard on delete (no dispatch)', () => {
    const { onApplyEdit } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ add enum' }));
    expect(screen.getAllByLabelText(/Enum \d+ name/)).toHaveLength(2);

    const deleteButtons = screen.getAllByRole('button', { name: /^Delete enum/ });
    fireEvent.click(deleteButtons[1]!);
    expect(onApplyEdit).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText(/Enum \d+ name/)).toHaveLength(1);
  });

  it('adding an enum and naming it dispatches upsertEnum on blur', () => {
    const { onApplyEdit } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ add enum' }));
    const name = screen.getByLabelText('Enum 2 name');
    fireEvent.change(name, { target: { value: 'order_status' } });
    fireEvent.blur(name);
    expect(onApplyEdit).toHaveBeenCalledWith({
      kind: 'upsertEnum',
      enum: { name: 'order_status', values: [], schema: null },
    });
  });

  it('blocks committing a new enum onto an already-existing name instead of silently overwriting it', () => {
    const { onApplyEdit } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ add enum' }));
    const name = screen.getByLabelText('Enum 2 name');
    fireEvent.change(name, { target: { value: 'user_kind' } });
    fireEvent.blur(name);
    expect(onApplyEdit).not.toHaveBeenCalled();
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
  });

  it('adds a value via the dashed adder (Enter commits), in order, then reorders and removes it', () => {
    const { onApplyEdit } = setup();
    const adder = screen.getByLabelText('Enum 1 add value');
    fireEvent.change(adder, { target: { value: 'bot' } });
    fireEvent.keyDown(adder, { key: 'Enter' });
    expect(onApplyEdit).toHaveBeenLastCalledWith({
      kind: 'upsertEnum',
      enum: { name: 'user_kind', values: ['human', 'agent', 'bot'], schema: null },
    });
    expect((adder as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByLabelText('Move enum 1 value 3 up'));
    expect(onApplyEdit).toHaveBeenLastCalledWith({
      kind: 'upsertEnum',
      enum: { name: 'user_kind', values: ['human', 'bot', 'agent'], schema: null },
    });

    fireEvent.click(screen.getByLabelText('Remove enum 1 value 1'));
    expect(onApplyEdit).toHaveBeenLastCalledWith({
      kind: 'upsertEnum',
      enum: { name: 'user_kind', values: ['bot', 'agent'], schema: null },
    });
  });

  it('the other card stays fully interactive after one card is delete-blocked', () => {
    const { onApplyEdit } = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ add enum' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete enum user_kind' })); // blocked
    expect(screen.getByText(/users\.kind/)).toBeInTheDocument();

    const name2 = screen.getByLabelText('Enum 2 name');
    fireEvent.change(name2, { target: { value: 'order_status' } });
    fireEvent.blur(name2);
    expect(onApplyEdit).toHaveBeenCalledWith({
      kind: 'upsertEnum',
      enum: { name: 'order_status', values: [], schema: null },
    });
  });
});
