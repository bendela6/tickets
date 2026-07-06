import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Button } from './button';

test('renders and clicks', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Save view</Button>);
  await userEvent.click(screen.getByRole('button', { name: 'Save view' }));
  expect(onClick).toHaveBeenCalledOnce();
});

test('primary variant gets accent classes', () => {
  render(<Button variant="primary">New ticket</Button>);
  const button = screen.getByRole('button');
  expect(button).toHaveClass('bg-accent');
  // Regression guard: cn()/tailwind-merge must not drop the text color when a
  // font-size utility is also present (custom named sizes like `text-ui` used to
  // silently evict `text-on-accent`, rendering dark text on the accent fill).
  expect(button).toHaveClass('text-on-accent');
  expect(button).toHaveClass('text-[13px]');
});

test('loading disables and marks busy', () => {
  render(<Button loading>Creating…</Button>);
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
});
