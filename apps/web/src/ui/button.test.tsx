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

test('sizes match design height/padding/radius/font-size', () => {
  const { rerender } = render(<Button size="compact">c</Button>);
  expect(screen.getByRole('button')).toHaveClass('h-7', 'px-2.5', 'rounded-[6px]', 'text-[12px]');
  rerender(<Button size="regular">r</Button>);
  expect(screen.getByRole('button')).toHaveClass('h-9', 'px-3.5', 'rounded-[8px]', 'text-[13px]');
  rerender(<Button size="touch">t</Button>);
  expect(screen.getByRole('button')).toHaveClass(
    'h-11',
    'px-[18px]',
    'rounded-[10px]',
    'text-[14px]',
  );
  rerender(<Button size="icon" aria-label="more" />);
  expect(screen.getByRole('button')).toHaveClass('h-8', 'w-8', 'p-0', 'rounded-[8px]');
});

test('focus halo is 3px accent-subtle, danger-subtle for destructive', () => {
  const { rerender } = render(<Button variant="primary">New</Button>);
  expect(screen.getByRole('button')).toHaveClass(
    'focus-visible:ring-[3px]',
    'focus-visible:ring-accent-subtle',
  );
  rerender(<Button variant="destructive">Archive</Button>);
  const danger = screen.getByRole('button');
  expect(danger).toHaveClass('focus-visible:ring-danger-subtle');
  expect(danger).not.toHaveClass('focus-visible:ring-accent-subtle');
});

test('disabled swaps variant colors; loading keeps the fill', () => {
  const { rerender } = render(
    <Button variant="primary" disabled>
      New
    </Button>,
  );
  // Pure-disabled: design swaps the accent fill for an inset/ink-3 treatment.
  expect(screen.getByRole('button')).toHaveClass('bg-inset', 'text-ink-3');
  expect(screen.getByRole('button')).not.toHaveClass('bg-accent');
  // Loading is also `disabled` but must keep the accent fill (design LOADING row).
  rerender(
    <Button variant="primary" loading>
      New
    </Button>,
  );
  const busy = screen.getByRole('button');
  expect(busy).toBeDisabled();
  expect(busy).toHaveClass('bg-accent');
  expect(busy).not.toHaveClass('bg-inset');
});

test('loading shows a 12px animating Spinner, hidden while not loading', () => {
  const { rerender } = render(<Button loading>Creating…</Button>);
  const spinner = screen.getByRole('img', { name: 'Loading' });
  expect(spinner.tagName.toLowerCase()).toBe('svg');
  expect(spinner).toHaveAttribute('width', '12');
  expect(spinner).toHaveAttribute('height', '12');
  expect(spinner).toHaveClass('animate-ai-spin');

  rerender(<Button>Creating…</Button>);
  expect(screen.queryByRole('img', { name: 'Loading' })).toBeNull();
});
