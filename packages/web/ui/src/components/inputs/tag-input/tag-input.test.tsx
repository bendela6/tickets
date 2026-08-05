import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { TagInput } from './tag-input';

const field = () => screen.getByRole('textbox');

test('Enter creates a tag from free text', async () => {
  const onChange = vi.fn();
  render(<TagInput value={[]} onChange={onChange} />);
  await userEvent.type(field(), 'infra{Enter}');
  expect(onChange).toHaveBeenCalledWith(['infra']);
});

test('a duplicate is refused, named, and nothing is added', async () => {
  // Silently doing nothing is the same response as a broken Enter key; adding a
  // second identical chip is worse.
  const onChange = vi.fn();
  render(<TagInput value={['flaky']} onChange={onChange} />);
  await userEvent.type(field(), 'flaky{Enter}');
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('flaky');
});

test('the refusal points at the chip that already exists', async () => {
  const { container } = render(<TagInput value={['flaky']} onChange={() => {}} />);
  await userEvent.type(field(), 'flaky{Enter}');
  expect(container.querySelector('.animate-nudge')).not.toBeNull();
});

test('a duplicate check ignores case, so Flaky does not slip past flaky', async () => {
  const onChange = vi.fn();
  render(<TagInput value={['flaky']} onChange={onChange} />);
  await userEvent.type(field(), 'FLAKY{Enter}');
  expect(onChange).not.toHaveBeenCalled();
});

test('the message clears on the next keystroke rather than needing dismissal', async () => {
  render(<TagInput value={['flaky']} onChange={() => {}} />);
  await userEvent.type(field(), 'flaky{Enter}');
  expect(screen.getByRole('alert')).toBeInTheDocument();
  await userEvent.type(field(), 'x');
  expect(screen.queryByRole('alert')).toBeNull();
});

test('Backspace removes the last chip only when the draft is empty', async () => {
  // Guarded on empty so it cannot eat a chip while you are correcting a typo.
  const onChange = vi.fn();
  const { rerender } = render(<TagInput value={['a', 'b']} onChange={onChange} />);
  await userEvent.type(field(), 'x{Backspace}');
  expect(onChange).not.toHaveBeenCalled();

  rerender(<TagInput value={['a', 'b']} onChange={onChange} />);
  await userEvent.click(field());
  await userEvent.keyboard('{Backspace}');
  expect(onChange).toHaveBeenCalledWith(['a']);
});

test('a chip can be removed by its own target', async () => {
  const onChange = vi.fn();
  render(<TagInput value={['infra']} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: /remove infra/i }));
  expect(onChange).toHaveBeenCalledWith([]);
});

test('suggestions are offered, never forced', async () => {
  render(
    <TagInput
      value={[]}
      onChange={() => {}}
      suggestions={[{ value: 'infrastructure', label: 'infrastructure' }]}
    />,
  );
  await userEvent.type(field(), 'infra');
  // Both the existing tag AND the free-text creation are on offer.
  expect(screen.getByRole('button', { name: /infrastructure/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Create/ })).toBeInTheDocument();
});

test('read-only drops the remove targets and refuses new tags', async () => {
  const onChange = vi.fn();
  render(<TagInput value={['infra']} onChange={onChange} readOnly />);
  expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  await userEvent.type(field(), 'more{Enter}');
  expect(onChange).not.toHaveBeenCalled();
});
