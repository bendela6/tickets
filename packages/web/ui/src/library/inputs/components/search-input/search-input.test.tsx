import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { SearchInput } from './search-input';

test('the shortcut shows while empty and gives way to the clear', async () => {
  // By the time you have typed you have already found the field, so the hint
  // has done its job.
  const { rerender } = render(
    <SearchInput value="" onChange={() => {}} shortcut="⌘K" aria-label="Search" />,
  );
  expect(screen.getByText('⌘K')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

  rerender(<SearchInput value="payment" onChange={() => {}} shortcut="⌘K" aria-label="Search" />);
  expect(screen.queryByText('⌘K')).toBeNull();
  expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
});

test('loading beats the clear, so the target does not move under the pointer', () => {
  // A clear button that vanishes the moment results arrive is a target that
  // moves while you are aiming at it.
  render(<SearchInput value="payment" onChange={() => {}} loading aria-label="Search" />);
  expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
});

test('clearing empties the value rather than reporting null', async () => {
  const onChange = vi.fn();
  render(<SearchInput value="payment" onChange={onChange} aria-label="Search" />);
  await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(onChange).toHaveBeenCalledWith('');
});

test('the clear is not a tab stop, and refuses a locked field', () => {
  render(<SearchInput value="x" onChange={() => {}} readOnly aria-label="Search" />);
  const clear = screen.getByRole('button', { name: 'Clear search' });
  expect(clear.getAttribute('tabindex')).toBe('-1');
  expect(clear).toBeDisabled();
});
