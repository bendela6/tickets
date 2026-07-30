import { useReducer } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { DEFAULT_DOC } from '../doc';
import { INITIAL_STATE, studioReducer } from '../state';
import { ElementPanel } from './element-panel';

/**
 * A mocked `dispatch` only proves an action was *sent*, not that it stuck —
 * exactly the gap that let a `spin` toggle on a ring or dot silently do
 * nothing (see the regression test below). This harness wires `ElementPanel`
 * to the real reducer, so assertions here are against the resulting
 * document, not a spy's call log.
 */
function Harness() {
  const [state, dispatch] = useReducer(studioReducer, INITIAL_STATE);
  return (
    <>
      <ElementPanel doc={state.doc} dispatch={dispatch} />
      <pre data-testid="doc">{JSON.stringify(state.doc.elements)}</pre>
    </>
  );
}

test('lists one row per element, in paint order', () => {
  render(<ElementPanel doc={DEFAULT_DOC} dispatch={vi.fn()} />);
  const rows = screen.getAllByRole('group');
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent('top');
  expect(rows[2]).toHaveTextContent('low');
});

// The two toHaveTextContent checks above cannot actually detect a reordered
// list: every row's ink <select> lists every ink name as an <option>
// (per the ink-selector requirement below), option text is part of jsdom's
// textContent regardless of which option is selected, and DEFAULT_DOC's
// three stick ids happen to equal its three ink names — so every row's
// group already contains the substrings "top" and "low" no matter which
// element it actually renders. This test pins DOM order directly against
// each row's own `remove <id>` button, whose accessible name is not
// polluted by a sibling `<select>`'s options, so it fails if paint order
// breaks in a way the two assertions above provably cannot.
test('rows render in the same order as doc.elements, not just the same count', () => {
  render(<ElementPanel doc={DEFAULT_DOC} dispatch={vi.fn()} />);
  const removeButtons = screen.getAllByRole('button', { name: /^remove /i });
  expect(removeButtons.map((b) => b.textContent)).toEqual(['remove top', 'remove mid', 'remove low']);
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

// Regression: blankElement (state.ts) previously left `spin` unset on a
// freshly added ring/dot, so updateElement's own-keys-only guard silently
// dropped a spin toggle on either — a dispatch fired, but it never stuck.
// Routed through the real reducer (see Harness above) so this fails the way
// the bug actually failed: a dispatch that goes nowhere.
test("toggling a newly added ring's spin checkbox actually sets spin on the resulting document", async () => {
  render(<Harness />);

  await userEvent.click(screen.getByRole('button', { name: /add ring/i }));
  await userEvent.click(screen.getByLabelText('ring-1 spin'));

  const elements = JSON.parse(screen.getByTestId('doc').textContent ?? '[]') as {
    id: string;
    spin?: boolean;
  }[];
  expect(elements.find((e) => e.id === 'ring-1')?.spin).toBe(true);
});
