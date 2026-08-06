import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { IconPicker } from './icon-picker';

const open = async () => userEvent.click(screen.getByRole('combobox'));

test('the trigger shows the GLYPH, not just its name', async () => {
  // `circle-dashed` describes a drawing far less well than the drawing does.
  const { container } = render(<IconPicker value="search" onChange={() => {}} />);
  const trigger = screen.getByRole('combobox');
  expect(trigger.querySelector('svg')).not.toBeNull();
  // …and the name stays, because it is what you search by.
  expect(trigger).toHaveTextContent('search');
});

test('typing filters the grid', async () => {
  render(<IconPicker value={null} onChange={() => {}} />);
  await open();
  const all = screen.getAllByRole('gridcell').length;
  await userEvent.type(screen.getByRole('searchbox'), 'chevron');
  const filtered = screen.getAllByRole('gridcell');
  expect(filtered.length).toBeLessThan(all);
  filtered.forEach((cell) => expect(cell.getAttribute('aria-label')).toContain('chevron'));
});

test('no results names the query and offers a way forward', async () => {
  // "No results" alone leaves you guessing whether the set is small or the
  // spelling was wrong.
  render(<IconPicker value={null} onChange={() => {}} />);
  await open();
  await userEvent.type(screen.getByRole('searchbox'), 'zzz');
  expect(screen.getByText(/No icon matches/)).toHaveTextContent('zzz');
  expect(screen.getByText(/Try/)).toBeInTheDocument();
  expect(screen.queryByRole('grid')).toBeNull();
});

test('filtering resets the cursor, so it cannot point past a shorter list', async () => {
  const onChange = vi.fn();
  render(<IconPicker value={null} onChange={onChange} />);
  await open();
  await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
  await userEvent.type(screen.getByRole('searchbox'), 'chevron-up');
  await userEvent.keyboard('{Enter}');
  expect(onChange).toHaveBeenCalledWith('chevron-up');
});

test('picking commits the icon name', async () => {
  const onChange = vi.fn();
  render(<IconPicker value={null} onChange={onChange} />);
  await open();
  await userEvent.click(screen.getByRole('gridcell', { name: 'search' }));
  expect(onChange).toHaveBeenCalledWith('search');
});

test('the offered set can be narrowed', async () => {
  render(<IconPicker value={null} onChange={() => {}} icons={['search', 'copy', 'trash']} />);
  await open();
  expect(screen.getAllByRole('gridcell')).toHaveLength(3);
});

test('read-only keeps the tab stop and refuses to open', async () => {
  render(<IconPicker value="search" onChange={() => {}} readOnly />);
  const trigger = screen.getByRole('combobox');
  await userEvent.tab();
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  expect(screen.queryByRole('searchbox')).toBeNull();
  expect(trigger).not.toBeDisabled();
});
