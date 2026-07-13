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
  it('adds each constraint kind with a fresh id', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ FK' }));
    const next = onChange.mock.calls[0]![0] as Constraint[];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'c1', kind: 'fk', columns: [], refTable: '', refColumns: [] });
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

  it('an fk row lists the target table’s columns once a table is chosen', () => {
    const onChange = setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refTable: '', refColumns: [], onDelete: null, onUpdate: null },
    ]);
    fireEvent.change(screen.getByLabelText('Constraint 1 target table'), { target: { value: 'users' } });
    expect((onChange.mock.calls[0]![0] as Constraint[])[0]).toMatchObject({ refTable: 'users', refColumns: [] });
    cleanup();

    setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refTable: 'users', refColumns: [], onDelete: null, onUpdate: null },
    ]);
    expect(screen.getByLabelText('Constraint 1 target column id')).toBeInTheDocument();
  });

  it('sets an fk action', () => {
    const onChange = setup([
      { id: 'c1', kind: 'fk', name: null, columns: ['users_id'], refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null },
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
      { id: 'c2', kind: 'unique', name: null, columns: ['users_id'] },
    ]);
    fireEvent.click(screen.getByLabelText('Remove constraint 1'));
    const next = onChange.mock.calls[0]![0] as Constraint[];
    expect(next.map((c) => c.id)).toEqual(['c2']);
  });
});
