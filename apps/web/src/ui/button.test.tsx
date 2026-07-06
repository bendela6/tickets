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
  expect(screen.getByRole('button')).toHaveClass('bg-accent');
});

test('loading disables and marks busy', () => {
  render(<Button loading>Creating…</Button>);
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
});
