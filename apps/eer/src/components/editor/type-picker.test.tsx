import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EnumDecl } from '../../engine/model/types';
import { TypePicker, type TypePickerProps } from './type-picker';

afterEach(cleanup);

function renderPicker(overrides: Partial<TypePickerProps> = {}) {
  const onPick = overrides.onPick ?? vi.fn();
  const onClose = overrides.onClose ?? vi.fn();
  render(
    <TypePicker
      value={overrides.value ?? 'text'}
      enums={overrides.enums ?? []}
      unknownBase={overrides.unknownBase ?? null}
      onPick={onPick}
      onClose={onClose}
    />,
  );
  return { onPick, onClose };
}

describe('TypePicker', () => {
  it('never offers a type drizzle cannot build', () => {
    renderPicker();
    for (const absent of ['bytea', 'box', 'varbit', 'path', 'polygon', 'circle']) {
      expect(screen.queryByRole('option', { name: absent })).toBeNull();
    }
  });

  it('lists the built-in groups as their own accessible groups', () => {
    renderPicker();
    expect(screen.getByRole('group', { name: 'numeric' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'text' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'numeric' })).getByRole('option', { name: 'integer' })).toBeInTheDocument();
  });

  it('lists model enums in their own violet section, never mixed into the built-ins', () => {
    const enums: EnumDecl[] = [{ name: 'user_kind', values: ['human', 'agent'], schema: null }];
    renderPicker({ enums });
    const section = screen.getByRole('group', { name: /enums in this model/i });
    expect(within(section).getByRole('option', { name: 'user_kind' })).toBeInTheDocument();
    // Not duplicated among the built-in groups.
    expect(within(screen.getByRole('group', { name: 'text' })).queryByRole('option', { name: 'user_kind' })).toBeNull();
  });

  it('filters by displayName', () => {
    renderPicker();
    fireEvent.change(screen.getByLabelText('Filter types…'), { target: { value: 'jsonb' } });
    expect(screen.getByRole('option', { name: 'jsonb' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'integer' })).toBeNull();
  });

  it('filters by group name even when it does not match any displayName', () => {
    renderPicker();
    fireEvent.change(screen.getByLabelText('Filter types…'), { target: { value: 'network' } });
    expect(screen.getByRole('option', { name: 'inet' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'integer' })).toBeNull();
  });

  it('filters enums by name too', () => {
    const enums: EnumDecl[] = [{ name: 'user_kind', values: ['human'], schema: null }];
    renderPicker({ enums });
    fireEvent.change(screen.getByLabelText('Filter types…'), { target: { value: 'user' } });
    expect(screen.getByRole('option', { name: 'user_kind' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'integer' })).toBeNull();
  });

  it('advertises a parameterised type\'s signature in its option label', () => {
    renderPicker();
    expect(screen.getByRole('option', { name: /numeric \(p,s\)/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /varchar \(n\)/ })).toBeInTheDocument();
  });

  it('marks the current value selected', () => {
    renderPicker({ value: 'jsonb' });
    expect(screen.getByRole('option', { name: 'jsonb' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'integer' })).toHaveAttribute('aria-selected', 'false');
  });

  it('pins an unknown type at the top, red and unselectable — clicking it does nothing', () => {
    const onPick = vi.fn();
    renderPicker({ value: 'legacy_money', unknownBase: 'legacy_money', onPick });
    const opt = screen.getByRole('option', { name: /legacy_money/ });
    expect(opt).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(opt);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('ArrowDown/ArrowUp move the cursor and Enter picks the highlighted row', () => {
    const onPick = vi.fn();
    renderPicker({ value: 'smallint', onPick });
    const panel = screen.getByRole('listbox');
    fireEvent.keyDown(panel, { key: 'ArrowDown' }); // smallint -> integer (catalogue order)
    fireEvent.keyDown(panel, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('integer');
  });

  it('ArrowUp from the first row wraps to the last row', () => {
    const enums: EnumDecl[] = [{ name: 'z_enum', values: ['a'], schema: null }];
    const onPick = vi.fn();
    renderPicker({ value: 'smallint', enums, onPick });
    const panel = screen.getByRole('listbox');
    fireEvent.keyDown(panel, { key: 'ArrowUp' }); // wraps past the start to the last row (the enum)
    fireEvent.keyDown(panel, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('z_enum');
  });

  it('Escape closes without picking', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    renderPicker({ onPick, onClose });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('clicking a built-in option picks it', () => {
    const onPick = vi.fn();
    renderPicker({ onPick });
    fireEvent.click(screen.getByRole('option', { name: 'boolean' }));
    expect(onPick).toHaveBeenCalledWith('boolean');
  });

  it('clicking an enum option picks it by name', () => {
    const enums: EnumDecl[] = [{ name: 'user_kind', values: ['human', 'agent'], schema: null }];
    const onPick = vi.fn();
    renderPicker({ enums, onPick });
    fireEvent.click(screen.getByRole('option', { name: 'user_kind' }));
    expect(onPick).toHaveBeenCalledWith('user_kind');
  });

  it('re-clamps the keyboard cursor after filtering shrinks the list, so Enter is never a silent no-op', () => {
    const onPick = vi.fn();
    renderPicker({ value: 'smallint', onPick });
    const panel = screen.getByRole('listbox');
    // Walk the cursor 5 rows down the full (unfiltered) numeric group:
    // smallint -> integer -> bigint -> smallserial -> serial -> bigserial.
    for (let i = 0; i < 5; i++) fireEvent.keyDown(panel, { key: 'ArrowDown' });
    // Filtering to the "text" group shrinks the list to 3 rows (text, varchar,
    // char) — well below the cursor's old index of 5.
    fireEvent.change(screen.getByLabelText('Filter types…'), { target: { value: 'text' } });
    fireEvent.keyDown(panel, { key: 'Enter' });
    // Enter must still pick a real, currently-visible row — never a silent
    // no-op just because the cursor used to point further down a longer list.
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('text');
  });

  it('de-dupes an enum whose name collides with a built-in catalogue type — rendered once, not twice', () => {
    const enums: EnumDecl[] = [{ name: 'text', values: ['a', 'b'], schema: null }];
    renderPicker({ enums });
    expect(screen.getAllByRole('option', { name: 'text' })).toHaveLength(1);
    // It's the built-in row that survives, not the enum section's.
    expect(screen.queryByRole('group', { name: /enums in this model/i })).toBeNull();
  });
});
