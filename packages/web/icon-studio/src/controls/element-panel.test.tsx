import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { DEFAULT_DOC } from '../doc';
import { ElementPanel } from './element-panel';

test('lists one row per element, in paint order', () => {
  render(<ElementPanel doc={DEFAULT_DOC} dispatch={vi.fn()} />);
  const rows = screen.getAllByRole('group');
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent('top');
  expect(rows[2]).toHaveTextContent('low');
});

test('adding an element of a chosen type dispatches once', async () => {
  const dispatch = vi.fn();
  render(<ElementPanel doc={DEFAULT_DOC} dispatch={dispatch} />);

  await userEvent.click(screen.getByRole('button', { name: /add ring/i }));
  expect(dispatch).toHaveBeenCalledWith({ type: 'addElement', elementType: 'ring' });
});

test('removing an element dispatches with that element id', async () => {
  const dispatch = vi.fn();
  render(<ElementPanel doc={DEFAULT_DOC} dispatch={dispatch} />);

  await userEvent.click(screen.getByRole('button', { name: /remove mid/i }));
  expect(dispatch).toHaveBeenCalledWith({ type: 'removeElement', id: 'mid' });
});

test('a stick shows angle, reach and weight; a ring does not show angle', () => {
  const doc = {
    ...DEFAULT_DOC,
    elements: [{ id: 'r', type: 'ring' as const, ink: 'top', radius: 15, weight: 3 }],
  };
  render(<ElementPanel doc={doc} dispatch={vi.fn()} />);

  expect(screen.getByLabelText(/r radius/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/r angle/i)).not.toBeInTheDocument();
});

test("dragging one element's slider dispatches to its own id, not a neighbour's", () => {
  const dispatch = vi.fn();
  render(<ElementPanel doc={DEFAULT_DOC} dispatch={dispatch} />);

  fireEvent.change(screen.getByLabelText('mid angle'), { target: { value: '99' } });

  expect(dispatch).toHaveBeenCalledWith({ type: 'updateElement', id: 'mid', patch: { angle: 99 } });
  expect(dispatch).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: 'updateElement', id: 'top' }),
  );
  expect(dispatch).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: 'updateElement', id: 'low' }),
  );
});
