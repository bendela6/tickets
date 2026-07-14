import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildModel } from '../../test/models';
import type { Constraint } from '../../engine/model/types';
import { ConstraintsEditor } from './constraints-editor';

afterEach(cleanup);

const model = buildModel(); // users(id), orders(id, users_id), tags(id)
const cols = ['id', 'users_id'];

const setup = (constraints: Constraint[] = []) => {
  const onChange = vi.fn();
  render(<ConstraintsEditor model={model} ownId="orders" columns={cols} constraints={constraints} onChange={onChange} />);
  return onChange;
};

describe('ConstraintsEditor', () => {
  it('adds each constraint kind with a fresh id, via typed adder buttons', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ foreign key' }));
    const next = onChange.mock.calls[0]![0] as Constraint[];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'c1', kind: 'fk', columns: [], refTable: '', refColumns: [] });
  });

  it('has typed adders for every kind (no generic "+ constraint")', () => {
    setup();
    expect(screen.getByRole('button', { name: '+ primary key' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ unique' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ foreign key' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ check' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^\+ constraint$/i })).not.toBeInTheDocument();
  });

  it('ticking columns adds them in tick order (composite keys are ordered)', () => {
    const onChange = setup([{ id: 'c1', kind: 'pk', name: null, columns: [] }]);
    fireEvent.click(screen.getByLabelText('Constraint 1 column users_id'));
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ columns: ['users_id'] });
    cleanup();

    const onChange2 = setup([{ id: 'c1', kind: 'pk', name: null, columns: ['users_id'] }]);
    fireEvent.click(screen.getByLabelText('Constraint 1 column id'));
    expect((onChange2.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ columns: ['users_id', 'id'] });
  });

  it('unticking a column removes it', () => {
    const onChange = setup([{ id: 'c1', kind: 'pk', name: null, columns: ['id', 'users_id'] }]);
    fireEvent.click(screen.getByLabelText('Constraint 1 column id'));
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ columns: ['users_id'] });
  });

  // The brief's own illustration of this rule: a composite key's chips must
  // read in the order the user picked them, NOT alphabetically/options
  // order — 'id' was ticked SECOND here, so it must carry badge "2", not "1".
  it('numbers composite-key chips in pick order, not alphabetical/options order', () => {
    setup([{ id: 'c1', kind: 'pk', name: null, columns: ['users_id', 'id'] }]);
    const usersChip = screen.getByLabelText('Constraint 1 column users_id').closest('label')!;
    const idChip = screen.getByLabelText('Constraint 1 column id').closest('label')!;
    expect(usersChip.textContent).toContain('1');
    expect(idChip.textContent).toContain('2');
  });

  it('an fk row lists the target table’s columns once a table is chosen', () => {
    const onChange = setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refSchema: null, refTable: '', refColumns: [], onDelete: null, onUpdate: null },
    ]);
    fireEvent.change(screen.getByLabelText('Constraint 1 target table'), { target: { value: 'users' } });
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ refTable: 'users', refColumns: [] });
    cleanup();

    setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refSchema: null, refTable: 'users', refColumns: [], onDelete: null, onUpdate: null },
    ]);
    expect(screen.getByLabelText('Constraint 1 target column id')).toBeInTheDocument();
  });

  it('sets an fk action', () => {
    const onChange = setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refSchema: null, refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
    ]);
    fireEvent.change(screen.getByLabelText('Constraint 1 on delete'), { target: { value: 'cascade' } });
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ onDelete: 'cascade' });
  });

  it('edits a check expression and a constraint name', () => {
    const onChange = setup([{ id: 'c1', kind: 'check', name: null, expression: '' }]);
    fireEvent.change(screen.getByLabelText('Constraint 1 expression'), { target: { value: 'number > 0' } });
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ expression: 'number > 0' });
    fireEvent.change(screen.getByLabelText('Constraint 1 name'), { target: { value: 'ck_number' } });
    expect((onChange.mock.calls[1]![0] as Constraint[])[0]).toMatchObject({ name: 'ck_number' });
  });

  it('removes a row', () => {
    const onChange = setup([
      { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
      { id: 'c2', kind: 'unique', name: null, columns: ['users_id'], nullsNotDistinct: false },
    ]);
    fireEvent.click(screen.getByLabelText('Remove constraint 1'));
    const next = onChange.mock.calls[0]![0] as Constraint[];
    expect(next.map((c) => c.id)).toEqual(['c2']);
  });

  it('unique carries a NULLS NOT DISTINCT checkbox bound to nullsNotDistinct', () => {
    const onChange = setup([{ id: 'c1', kind: 'unique', name: null, columns: ['users_id'], nullsNotDistinct: false }]);
    const checkbox = screen.getByLabelText('Constraint 1 nulls not distinct') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ nullsNotDistinct: true });
  });

  it('a pk/unique/check without a kind badge for foreign key stays a neutral (non-blue) badge', () => {
    setup([
      { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
      { id: 'c2', kind: 'unique', name: null, columns: ['users_id'], nullsNotDistinct: false },
      { id: 'c3', kind: 'check', name: null, expression: 'true' },
    ]);
    for (const label of ['primary key', 'unique', 'check']) {
      const badge = screen.getByText(label);
      expect(badge.className).not.toMatch(/blue/);
    }
  });

  it('only the foreign key badge is blue, and its card says it draws an edge', () => {
    setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refSchema: null, refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
    ]);
    expect(screen.getByText('foreign key').className).toMatch(/blue/);
    expect(screen.getByText(/draws an edge/i)).toBeInTheDocument();
  });

  it('shows the postgres-generated name, greyed, as a placeholder — never as a stored value', () => {
    const onChange = setup([{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }]);
    const nameInput = screen.getByLabelText('Constraint 1 name') as HTMLInputElement;
    expect(nameInput.placeholder).toBe('orders_pkey');
    expect(nameInput.value).toBe('');
    // Nothing was typed — onChange must never have been called with a
    // non-null name just because a generated preview is showing.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a composite pk previews the drizzle table-level convention', () => {
    setup([{ id: 'c1', kind: 'pk', name: null, columns: ['id', 'users_id'] }]);
    expect((screen.getByLabelText('Constraint 1 name') as HTMLInputElement).placeholder).toBe('orders_id_users_id_pk');
  });

  it('a unique constraint previews the drizzle unique() convention', () => {
    setup([{ id: 'c1', kind: 'unique', name: null, columns: ['users_id'], nullsNotDistinct: false }]);
    expect((screen.getByLabelText('Constraint 1 name') as HTMLInputElement).placeholder).toBe('orders_users_id_unique');
  });

  it('an fk previews the drizzle foreignKey() convention once fully specified', () => {
    setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refSchema: null, refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
    ]);
    expect((screen.getByLabelText('Constraint 1 name') as HTMLInputElement).placeholder).toBe('orders_users_id_users_id_fk');
  });

  it('typing a name overrides the greyed preview', () => {
    const onChange = setup([{ id: 'c1', kind: 'pk', name: null, columns: ['id'] }]);
    fireEvent.change(screen.getByLabelText('Constraint 1 name'), { target: { value: 'orders_custom_pk' } });
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ name: 'orders_custom_pk' });
  });

  it('a blank name is written as null, not the preview string', () => {
    const onChange = setup([{ id: 'c1', kind: 'pk', name: 'orders_custom_pk', columns: ['id'] }]);
    fireEvent.change(screen.getByLabelText('Constraint 1 name'), { target: { value: '' } });
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ name: null });
  });

  it('flags an fk arity mismatch at the mistake: red-tinted chips + an in-card message', () => {
    setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['id', 'users_id'], refSchema: null, refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
    ]);
    expect(screen.getByText(/same number of columns/i)).toBeInTheDocument();
    const localChip = screen.getByLabelText('Constraint 1 column id').closest('label')!;
    expect(localChip.className).toMatch(/red/);
    const targetChip = screen.getByLabelText('Constraint 1 target column id').closest('label')!;
    expect(targetChip.className).toMatch(/red/);
  });

  it('flags a duplicate constraint name at the mistake: red border + an in-card message on both rows', () => {
    setup([
      { id: 'c1', kind: 'unique', name: 'dup', columns: ['id'], nullsNotDistinct: false },
      { id: 'c2', kind: 'unique', name: 'dup', columns: ['users_id'], nullsNotDistinct: false },
    ]);
    expect(screen.getAllByText(/duplicate constraint name/i)).toHaveLength(2);
  });

  it('flags a blank check expression at the mistake: red border on the expression input', () => {
    setup([{ id: 'c1', kind: 'check', name: null, expression: '' }]);
    expect(screen.getByText(/non-blank expression/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Constraint 1 expression').className).toMatch(/red/);
  });

  // Task 12 review, Finding 2 (IMPORTANT): unlike pk/unique/fk (where Postgres
  // or drizzle really does assign a name when one is left blank — see
  // generated-constraint-name.ts), a CHECK constraint has NO auto-name at all
  // (export-drizzle's emitCheck throws on a blank one). A greyed placeholder
  // implying "safe to leave blank" would be a lie here, so a CHECK card must
  // instead treat the name as a required field — same red-border-at-the-
  // mistake idiom as the blank-expression case above, not a passive hint.
  it('a blank CHECK name is a required-field mistake, not a safe-to-leave-blank preview', () => {
    setup([{ id: 'c1', kind: 'check', name: null, expression: 'total > 0' }]);
    expect(screen.getByText(/must have a name/i)).toBeInTheDocument();
    const nameInput = screen.getByLabelText('Constraint 1 name') as HTMLInputElement;
    expect(nameInput.className).toMatch(/red/);
    // No greyed auto-name preview — the placeholder must not look like a real
    // generated name (contrast the pk/unique/fk previews tested above).
    expect(nameInput.placeholder).not.toMatch(/_check/);
  });
});
