import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TableIndex } from '../../engine/model/types';
import { IndexesEditor } from './indexes-editor';

afterEach(cleanup);

const cols = ['id', 'users_id'];
const setup = (indexes: TableIndex[] = []) => {
  const onChange = vi.fn();
  render(<IndexesEditor columns={cols} indexes={indexes} onChange={onChange} />);
  return onChange;
};

const col = (expression: string) => ({ expression, isExpression: false, order: null, nulls: null, opClass: null });

describe('IndexesEditor', () => {
  it('adds an empty index with a fresh id', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: /add index/i }));
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]).toEqual({
      id: 'i1', name: '', columns: [], unique: false, method: null, only: false, where: null,
    });
  });

  it('edits name, columns (in tick order) and unique', () => {
    const onChange = setup([{ id: 'i1', name: '', columns: [], unique: false, method: null, only: false, where: null }]);
    fireEvent.change(screen.getByLabelText('Index 1 name'), { target: { value: 'idx_orders_user' } });
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]).toMatchObject({ name: 'idx_orders_user' });
    fireEvent.click(screen.getByLabelText('Index 1 column users_id'));
    expect((onChange.mock.calls[1]![0] as TableIndex[])[0]).toMatchObject({ columns: [col('users_id')] });
    fireEvent.click(screen.getByLabelText('Index 1 unique'));
    expect((onChange.mock.calls[2]![0] as TableIndex[])[0]).toMatchObject({ unique: true });
  });

  // CRITICAL, reviewer-found: ColumnMultiSelect.onChange emits the whole
  // tick-ordered array of column NAMES, and the old toIndexColumns rebuilt
  // EVERY entry as a flattened plain column — so ticking (or unticking) any
  // ONE column of a composite index wiped order/nulls/opClass/isExpression
  // from every OTHER, untouched column of that index. The fix merges: an
  // already-ticked name keeps its existing IndexColumn object verbatim; only
  // a newly-ticked name gets a fresh default one.
  it('ticking an additional column preserves the existing IndexColumn (order/nulls/opClass) of the already-ticked one', () => {
    const richCol = { expression: 'id', isExpression: false, order: 'desc' as const, nulls: 'last' as const, opClass: 'text_ops' };
    const onChange = setup([{ id: 'i1', name: 'idx', columns: [richCol], unique: false, method: null, only: false, where: null }]);
    fireEvent.click(screen.getByLabelText('Index 1 column users_id'));
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]!.columns).toEqual([richCol, col('users_id')]);
  });

  it('removes an index', () => {
    const onChange = setup([
      { id: 'i1', name: 'a', columns: [col('id')], unique: false, method: null, only: false, where: null },
      { id: 'i2', name: 'b', columns: [col('users_id')], unique: true, method: null, only: false, where: null },
    ]);
    fireEvent.click(screen.getByLabelText('Remove index 1'));
    expect((onChange.mock.calls[0]![0] as TableIndex[]).map((i) => i.id)).toEqual(['i2']);
  });

  it('numbers composite-index chips in pick order, not options order', () => {
    setup([{ id: 'i1', name: 'idx', columns: [col('users_id'), col('id')], unique: false, method: null, only: false, where: null }]);
    const usersChip = screen.getByLabelText('Index 1 column users_id').closest('label')!;
    const idChip = screen.getByLabelText('Index 1 column id').closest('label')!;
    expect(usersChip.textContent).toContain('1');
    expect(idChip.textContent).toContain('2');
  });

  it('each picked column gets its own ASC/DESC toggle that cycles on click', () => {
    const onChange = setup([{ id: 'i1', name: 'idx', columns: [col('id')], unique: false, method: null, only: false, where: null }]);
    const orderBtn = screen.getByLabelText('Index 1 column id order');
    fireEvent.click(orderBtn);
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]!.columns[0]).toMatchObject({ order: 'asc' });
  });

  it('each picked column gets its own NULLS FIRST/LAST select', () => {
    const onChange = setup([{ id: 'i1', name: 'idx', columns: [col('id')], unique: false, method: null, only: false, where: null }]);
    fireEvent.change(screen.getByLabelText('Index 1 column id nulls'), { target: { value: 'last' } });
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]!.columns[0]).toMatchObject({ nulls: 'last' });
  });

  it('has a method select offering btree, hash, gin, gist, brin', () => {
    const onChange = setup([{ id: 'i1', name: 'idx', columns: [col('id')], unique: false, method: null, only: false, where: null }]);
    const select = screen.getByLabelText('Index 1 method') as HTMLSelectElement;
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['btree', 'hash', 'gin', 'gist', 'brin']));
    fireEvent.change(select, { target: { value: 'gin' } });
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]).toMatchObject({ method: 'gin' });
  });

  it('a WHERE input makes the index partial; empty shows "— full index" greyed', () => {
    const onChange = setup([{ id: 'i1', name: 'idx', columns: [col('id')], unique: false, method: null, only: false, where: null }]);
    const whereInput = screen.getByLabelText('Index 1 where') as HTMLInputElement;
    expect(whereInput.placeholder).toMatch(/full index/i);
    fireEvent.change(whereInput, { target: { value: 'active = true' } });
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]).toMatchObject({ where: 'active = true' });
  });

  it('the unique checkbox is captioned as a separate thing from a UNIQUE constraint', () => {
    setup([{ id: 'i1', name: 'idx', columns: [col('id')], unique: false, method: null, only: false, where: null }]);
    expect(screen.getByText(/separate from a unique constraint/i)).toBeInTheDocument();
  });

  it('flags a duplicate index name at the mistake: red border + an in-card message on both cards', () => {
    setup([
      { id: 'i1', name: 'dup', columns: [col('id')], unique: false, method: null, only: false, where: null },
      { id: 'i2', name: 'dup', columns: [col('users_id')], unique: false, method: null, only: false, where: null },
    ]);
    expect(screen.getAllByText(/duplicate index name/i)).toHaveLength(2);
  });

  it('flags an index with no columns at the mistake: red-tinted picker + an in-card message', () => {
    setup([{ id: 'i1', name: 'idx', columns: [], unique: false, method: null, only: false, where: null }]);
    expect(screen.getByText(/at least one column/i)).toBeInTheDocument();
  });
});
