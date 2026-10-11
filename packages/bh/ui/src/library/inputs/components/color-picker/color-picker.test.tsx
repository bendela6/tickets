import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { HUES } from '../../../../style';
import { ColorPicker } from './color-picker';

const open = async () => userEvent.click(screen.getByRole('combobox'));

test('the palette is the eleven ramps and nothing else', async () => {
  // No spectrum, no eyedropper. A free colour is a colour with no rung, and so
  // no readable text pair and no fill.
  render(<ColorPicker value="blue" onChange={() => {}} />);
  await open();
  expect(screen.getAllByRole('gridcell')).toHaveLength(HUES.length);
  expect(screen.queryByRole('slider')).toBeNull();
});

test('the trigger shows a swatch AND a name, always both', () => {
  // A swatch alone cannot be spoken or searched; a name alone throws away the
  // reason colour was used.
  const { container } = render(<ColorPicker value="green" onChange={() => {}} />);
  expect(screen.getByRole('combobox')).toHaveTextContent('Green');
  expect(container.querySelector('.bg-green-9')).not.toBeNull();
});

test('selection is an inset dot, never a border on the swatch', async () => {
  // A border sits on the swatch's own edge and mixes with it, so the colour you
  // are judging stops being the colour you get.
  render(<ColorPicker value="red" onChange={() => {}} />);
  await open();
  const swatch = screen.getByRole('gridcell', { name: 'Red' });
  expect(swatch.querySelector('.bg-red-contrast')).not.toBeNull();
  expect(swatch.className).not.toMatch(/border-\d/);
});

test('an unselected swatch carries no dot', async () => {
  render(<ColorPicker value="red" onChange={() => {}} />);
  await open();
  expect(screen.getByRole('gridcell', { name: 'Blue' }).children).toHaveLength(0);
});

test('arrows move the cursor and Enter picks', async () => {
  const onChange = vi.fn();
  render(<ColorPicker value={HUES[0]} onChange={onChange} />);
  await open();
  await userEvent.keyboard('{ArrowRight}{Enter}');
  expect(onChange).toHaveBeenCalledWith(HUES[1]);
});

test('the cursor clamps at the ends rather than wrapping off the grid', async () => {
  // The last row is short, so wrapping would land on an index nothing draws.
  const onChange = vi.fn();
  render(<ColorPicker value={HUES[0]} onChange={onChange} />);
  await open();
  await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{Enter}');
  expect(onChange).toHaveBeenCalledWith(HUES[0]);
});

test('the placeholder stands in for no colour', () => {
  render(<ColorPicker value={null} onChange={() => {}} placeholder="Pick one" />);
  expect(screen.getByRole('combobox')).toHaveTextContent('Pick one');
});

test('read-only keeps the tab stop and refuses to open', async () => {
  render(<ColorPicker value="blue" onChange={() => {}} readOnly />);
  const trigger = screen.getByRole('combobox');
  await userEvent.tab();
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  expect(screen.queryByRole('grid')).toBeNull();
  expect(trigger).not.toBeDisabled();
});

test('the grid holds its swatches in rows of six', async () => {
  render(<ColorPicker value={null} onChange={() => {}} />);
  await open();
  const rows = screen.getAllByRole('row');
  expect(rows.map((row) => within(row).getAllByRole('gridcell').length)).toEqual([6, 5]);
});

test('opening focuses the chosen swatch, and the arrows take focus with them', async () => {
  // Focus is where the highlight is, so a screen reader says the swatch the
  // arrows reached.
  render(<ColorPicker value={HUES[2]} onChange={() => {}} />);
  await open();
  const cells = () => screen.getAllByRole('gridcell');
  expect(cells()[2]).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  expect(cells()[3]).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}');
  expect(cells()[9]).toHaveFocus();
});
