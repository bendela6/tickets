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

describe('IndexesEditor', () => {
  it('adds an empty index with a fresh id', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: /add index/i }));
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]).toEqual({ id: 'i1', name: '', columns: [], unique: false });
  });

  it('edits name, columns (in tick order) and unique', () => {
    const onChange = setup([{ id: 'i1', name: '', columns: [], unique: false }]);
    fireEvent.change(screen.getByLabelText('Index 1 name'), { target: { value: 'idx_orders_user' } });
    expect((onChange.mock.calls[0]![0] as TableIndex[])[0]).toMatchObject({ name: 'idx_orders_user' });
    fireEvent.click(screen.getByLabelText('Index 1 column users_id'));
    expect((onChange.mock.calls[1]![0] as TableIndex[])[0]).toMatchObject({ columns: ['users_id'] });
    fireEvent.click(screen.getByLabelText('Index 1 unique'));
    expect((onChange.mock.calls[2]![0] as TableIndex[])[0]).toMatchObject({ unique: true });
  });

  it('removes an index', () => {
    const onChange = setup([
      { id: 'i1', name: 'a', columns: ['id'], unique: false },
      { id: 'i2', name: 'b', columns: ['users_id'], unique: true },
    ]);
    fireEvent.click(screen.getByLabelText('Remove index 1'));
    expect((onChange.mock.calls[0]![0] as TableIndex[]).map((i) => i.id)).toEqual(['i2']);
  });
});
