import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EnumDecl } from '../../engine/model/types';
import { TypeCell, type TypeCellProps } from './type-cell';

afterEach(cleanup);

// The real app (columns-grid.tsx) feeds the just-emitted value back in as the
// `value` prop on every keystroke (the grid re-renders the cell from its own
// state) — this wrapper reproduces that loop so tests exercising a sequence of
// edits (param typing, array toggling, picking) see the same thing the real
// app does, instead of only ever a single static `value` prop.
function ControlledTypeCell(props: { initial: string; enums?: EnumDecl[]; onEmit?: (v: string) => void }) {
  const [value, setValue] = useState(props.initial);
  return (
    <TypeCell
      value={value}
      enums={props.enums}
      onChange={(v) => {
        setValue(v);
        props.onEmit?.(v);
      }}
    />
  );
}

function renderCell(overrides: Partial<TypeCellProps> & { value: string }) {
  const onChange = overrides.onChange ?? vi.fn();
  render(<ControlledTypeCell initial={overrides.value} enums={overrides.enums} onEmit={onChange} />);
  return { onChange };
}

// Opens the trigger, then clicks the option whose label starts with `name`
// (parameterised types render their signature after the name, e.g.
// "numeric (p,s)", so this matches by prefix rather than exact text).
async function pick(name: string) {
  await userEvent.click(screen.getByLabelText('type'));
  await userEvent.click(screen.getByRole('option', { name: new RegExp('^' + name + '\\b') }));
}

describe('TypeCell', () => {
  it('shows the current type on the trigger and opens the picker on click', async () => {
    render(<TypeCell value="integer" onChange={vi.fn()} />);
    expect(screen.getByLabelText('type')).toHaveTextContent('integer');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('type'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('picking a type from the panel emits it and closes the panel', async () => {
    const { onChange } = renderCell({ value: 'integer' });
    await pick('text');
    expect(onChange).toHaveBeenLastCalledWith('text');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('grows one param input for varchar and emits varchar(n)', async () => {
    const { onChange } = renderCell({ value: 'text' });
    await pick('varchar');
    expect(screen.getByLabelText('n')).toHaveValue('');
    await userEvent.type(screen.getByLabelText('n'), '64');
    expect(onChange).toHaveBeenLastCalledWith('varchar(64)');
  });

  it('grows two param inputs for numeric and emits numeric(p,s)', async () => {
    const { onChange } = renderCell({ value: 'text' });
    await pick('numeric');
    await userEvent.type(screen.getByLabelText('p'), '10');
    await userEvent.type(screen.getByLabelText('s'), '2');
    expect(onChange).toHaveBeenLastCalledWith('numeric(10,2)');
  });

  it('picking a non-parameterised type removes any param inputs', async () => {
    renderCell({ value: 'varchar(64)' });
    expect(screen.getByLabelText('n')).toBeInTheDocument();
    await pick('text');
    expect(screen.queryByLabelText('n')).not.toBeInTheDocument();
  });

  it('makes a type an array with the [] control, and back', async () => {
    const { onChange } = renderCell({ value: 'text' });
    await userEvent.click(screen.getByRole('checkbox', { name: '[]' }));
    expect(onChange).toHaveBeenLastCalledWith('text[]');
    await userEvent.click(screen.getByRole('checkbox', { name: '[]' }));
    expect(onChange).toHaveBeenLastCalledWith('text');
  });

  it('keeps params when toggling the array flag', async () => {
    const { onChange } = renderCell({ value: 'varchar(64)' });
    await userEvent.click(screen.getByRole('checkbox', { name: '[]' }));
    expect(onChange).toHaveBeenLastCalledWith('varchar(64)[]');
  });

  it('pins an unknown type at the top of the (forced-open) picker, red and unselectable', () => {
    render(<TypeCell value="legacy_money" onChange={vi.fn()} />);
    expect(screen.getByRole('listbox')).toBeInTheDocument(); // forced open — no valid closed state
    const opt = screen.getByRole('option', { name: /legacy_money/ });
    expect(opt).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('type')).toHaveTextContent('legacy_money');
  });

  it('an unknown type has no free-text input anywhere in the cell', () => {
    render(<TypeCell value="legacy_money" onChange={vi.fn()} />);
    expect(screen.queryByLabelText('custom type')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'type' })).not.toBeInTheDocument();
  });

  it('picking a real type out of the forced-open picker resolves an unknown value', async () => {
    const { onChange } = renderCell({ value: 'legacy_money' });
    await userEvent.click(screen.getByRole('option', { name: 'text' }));
    expect(onChange).toHaveBeenLastCalledWith('text');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('a value matching a declared model enum is a valid pick, not an unknown one', () => {
    const enums: EnumDecl[] = [{ name: 'user_kind', values: ['human', 'agent'], schema: null }];
    render(<TypeCell value="user_kind" onChange={vi.fn()} enums={enums} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); // valid — stays closed
    expect(screen.getByLabelText('type')).toHaveTextContent('user_kind');
  });

  it('lists the model enums section when opened', async () => {
    const enums: EnumDecl[] = [{ name: 'user_kind', values: ['human', 'agent'], schema: null }];
    render(<TypeCell value="text" onChange={vi.fn()} enums={enums} />);
    await userEvent.click(screen.getByLabelText('type'));
    expect(
      within(screen.getByRole('group', { name: /enums in this model/i })).getByRole('option', { name: 'user_kind' }),
    ).toBeInTheDocument();
  });

  it('picking a declared enum emits its bare name', async () => {
    const enums: EnumDecl[] = [{ name: 'user_kind', values: ['human', 'agent'], schema: null }];
    const { onChange } = renderCell({ value: 'text', enums });
    await userEvent.click(screen.getByLabelText('type'));
    await userEvent.click(screen.getByRole('option', { name: 'user_kind' }));
    expect(onChange).toHaveBeenLastCalledWith('user_kind');
  });

  it('Escape closes the picker for a valid value without changing it', async () => {
    const { onChange } = renderCell({ value: 'integer' });
    await userEvent.click(screen.getByLabelText('type'));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('resyncs to a new value prop (grid reuses the row for a different column)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<TypeCell value="integer" onChange={onChange} />);
    expect(screen.getByLabelText('type')).toHaveTextContent('integer');
    rerender(<TypeCell value="varchar(255)" onChange={onChange} />);
    expect(screen.getByLabelText('type')).toHaveTextContent('varchar');
    expect(screen.getByLabelText('n')).toHaveValue('255');
  });
});
