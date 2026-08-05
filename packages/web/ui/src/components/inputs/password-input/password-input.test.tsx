import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { PasswordInput } from './password-input';

test('the value is obscured until you ask, and the toggle says which it means', async () => {
  // The word rather than an eye glyph: a crossed-out eye is ambiguous about
  // whether it describes the state or the action.
  render(<PasswordInput value="sk_live_4f2a" onChange={() => {}} aria-label="Key" />);
  const input = screen.getByLabelText('Key');
  expect(input).toHaveAttribute('type', 'password');

  await userEvent.click(screen.getByRole('button', { name: 'show' }));
  expect(input).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'hide' })).toBeInTheDocument();
});

test('the toggle is not a tab stop', async () => {
  // Tabbing out of a password field should reach the next field, not a control
  // most people never touch.
  render(
    <>
      <PasswordInput value="x" onChange={() => {}} aria-label="Key" />
      <input aria-label="Next" />
    </>,
  );
  await userEvent.tab();
  expect(screen.getByLabelText('Key')).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByLabelText('Next')).toHaveFocus();
});

test('a read-only secret can still be revealed — reading is the point', () => {
  render(<PasswordInput value="x" onChange={() => {}} readOnly aria-label="Key" />);
  expect(screen.getByRole('button', { name: 'show' })).toBeEnabled();
});

test('a disabled field drops the toggle with everything else', () => {
  render(<PasswordInput value="x" onChange={() => {}} disabled aria-label="Key" />);
  expect(screen.getByRole('button', { name: 'show' })).toBeDisabled();
});
