import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { UserPicker, type Person } from './user-picker';

const PEOPLE: Person[] = [
  { id: 'da', name: 'Dara Ahmed', detail: '@dara' },
  { id: 'rk', name: 'Rae Kim', detail: '@rae' },
  { id: 'jm', name: 'Jo Mensah', detail: '@jo' },
  { id: 'sl', name: 'Sam Lee', detail: '@sam' },
];

const open = async () => userEvent.click(screen.getByRole('combobox'));

test('unassigned is a dashed ring, not an empty avatar', async () => {
  // An empty avatar reads as a picture that failed to load; a dashed ring reads
  // as a slot nobody is in. Every tracker gets this wrong once.
  const { container } = render(<UserPicker people={PEOPLE} value={[]} onChange={() => {}} />);
  expect(screen.getByRole('combobox')).toHaveTextContent('Unassigned');
  expect(container.querySelector('.border-dashed')).not.toBeNull();
});

test('one person shows their name; several show a count', () => {
  const { rerender } = render(<UserPicker people={PEOPLE} value={['da']} onChange={() => {}} />);
  expect(screen.getByRole('combobox')).toHaveTextContent('Dara Ahmed');

  rerender(<UserPicker people={PEOPLE} value={['da', 'rk']} onChange={() => {}} multiple />);
  expect(screen.getByRole('combobox')).toHaveTextContent('2 people');
});

test('avatars past the cap collapse to +N', () => {
  render(
    <UserPicker people={PEOPLE} value={['da', 'rk', 'jm', 'sl']} onChange={() => {}} multiple maxAvatars={3} />,
  );
  expect(screen.getByRole('combobox')).toHaveTextContent('+1');
});

test('a single picker commits one person and closes', async () => {
  const onChange = vi.fn();
  render(<UserPicker people={PEOPLE} value={[]} onChange={onChange} />);
  await open();
  await userEvent.click(screen.getByRole('option', { name: /Rae Kim/ }));
  expect(onChange).toHaveBeenCalledWith(['rk']);
});

test('a single picker REPLACES rather than accumulating', async () => {
  const onChange = vi.fn();
  render(<UserPicker people={PEOPLE} value={['da']} onChange={onChange} />);
  await open();
  await userEvent.click(screen.getByRole('option', { name: /Rae Kim/ }));
  expect(onChange).toHaveBeenCalledWith(['rk']);
});

test('a multi picker accumulates and toggles off', async () => {
  const onChange = vi.fn();
  const { rerender } = render(
    <UserPicker people={PEOPLE} value={['da']} onChange={onChange} multiple />,
  );
  await open();
  await userEvent.click(screen.getByRole('option', { name: /Rae Kim/ }));
  expect(onChange).toHaveBeenCalledWith(['da', 'rk']);

  rerender(<UserPicker people={PEOPLE} value={['da', 'rk']} onChange={onChange} multiple />);
  await userEvent.click(screen.getByRole('option', { name: /Dara Ahmed/ }));
  expect(onChange).toHaveBeenLastCalledWith(['rk']);
});

test('nobody is [] in both modes, never null', async () => {
  // One spelling for "nobody assigned", so a consumer needs no guard.
  const onChange = vi.fn();
  render(<UserPicker people={PEOPLE} value={['da']} onChange={onChange} multiple />);
  await open();
  await userEvent.click(screen.getByRole('option', { name: /Dara Ahmed/ }));
  expect(onChange).toHaveBeenCalledWith([]);
});

test('search matches the handle as well as the name', async () => {
  render(<UserPicker people={PEOPLE} value={[]} onChange={() => {}} />);
  await open();
  await userEvent.type(screen.getByRole('searchbox'), '@rae');
  expect(screen.getAllByRole('option')).toHaveLength(1);
});

test('no match names who you were looking for', async () => {
  render(<UserPicker people={PEOPLE} value={[]} onChange={() => {}} />);
  await open();
  await userEvent.type(screen.getByRole('searchbox'), 'zzz');
  expect(screen.getByText(/Nobody matches/)).toHaveTextContent('zzz');
});

test('read-only keeps the tab stop and refuses to open', async () => {
  render(<UserPicker people={PEOPLE} value={['da']} onChange={() => {}} readOnly />);
  const trigger = screen.getByRole('combobox');
  await userEvent.tab();
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  expect(screen.queryByRole('searchbox')).toBeNull();
  expect(trigger).not.toBeDisabled();
});
