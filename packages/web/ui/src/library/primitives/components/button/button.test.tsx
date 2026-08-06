import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { focusRing } from '../../../../style';
import { Button } from './button';

test('renders and clicks', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Save view</Button>);
  await userEvent.click(screen.getByRole('button', { name: 'Save view' }));
  expect(onClick).toHaveBeenCalledOnce();
});

test('solid variant gets accent classes', () => {
  render(<Button variant="solid">New ticket</Button>);
  const button = screen.getByRole('button');
  expect(button).toHaveClass('bg-indigo-9');
  // Regression guard: cn()/tailwind-merge must not drop the text color when a
  // font-size utility is also present (custom named sizes like `text-13/19` used to
  // silently evict `text-indigo-contrast`, rendering dark text on the accent fill).
  expect(button).toHaveClass('text-indigo-contrast');
  expect(button).toHaveClass('text-13');
});

test('loading disables and marks busy', () => {
  render(<Button loading>Creating…</Button>);
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
});

test('outline shares its border-2 weight with Pill/CopyButton outline', () => {
  // button.tsx's own comment: Button `outline` and Pill `outline` must not
  // diverge on a shared variant name. design-system.html calls this weight
  // "edges you act on" (inputs, cards, outline controls); Button used to be
  // border-1 while Pill/CopyButton were already border-2 — this pins the
  // reconciled value so the two can't silently drift apart again.
  render(<Button variant="outline">Outline</Button>);
  const button = screen.getByRole('button');
  expect(button).toHaveClass('border-2');
  expect(button).not.toHaveClass('border-1');
});

test('sizes match design height/padding/radius/font-size', () => {
  const { rerender } = render(<Button size="sm">c</Button>);
  expect(screen.getByRole('button')).toHaveClass('h-28', 'px-10', 'rounded-md', 'text-12');
  rerender(<Button size="md">r</Button>);
  expect(screen.getByRole('button')).toHaveClass('h-36', 'px-14', 'rounded-lg', 'text-13');
  rerender(<Button size="lg">t</Button>);
  expect(screen.getByRole('button')).toHaveClass(
    'h-44',
    'px-[18px]',
    'rounded-xl',
    'text-14',
  );
});

test('the focus halo follows tone, and is the library-wide one', () => {
  // What the halo looks like is `focusRing`'s to decide — this asserts only
  // that the button wears THAT ring, and that it repaints with tone.
  const { rerender } = render(<Button variant="solid">New</Button>);
  expect(screen.getByRole('button').className).toContain(focusRing('indigo'));
  rerender(<Button variant="solid" tone="danger">Archive</Button>);
  const danger = screen.getByRole('button');
  expect(danger.className).toContain(focusRing('red'));
  expect(danger.className).not.toContain(focusRing('indigo'));
});

test('tone repaints the variant onto another ramp', () => {
  // These classes exist nowhere in source text — they are built by
  // interpolation, which is why the generated safelist has to carry them.
  const { rerender } = render(
    <Button variant="solid" tone="success">
      Approve
    </Button>,
  );
  const success = screen.getByRole('button');
  expect(success).toHaveClass('bg-green-9', 'text-green-contrast', 'hover:bg-green-10');
  expect(success).not.toHaveClass('bg-indigo-9');

  // A tone name is not a ramp name: `primary` has to resolve to `indigo`
  // before it reaches a class string, or this would be `bg-primary-9`.
  rerender(<Button variant="solid">Save</Button>);
  expect(screen.getByRole('button')).toHaveClass('bg-indigo-9');

  // What used to be variant="destructive" is now solid + the danger ramp.
  rerender(<Button variant="solid" tone="danger">Delete</Button>);
  expect(screen.getByRole('button')).toHaveClass('bg-red-9');
});

test('disabled swaps variant colors; loading keeps the fill', () => {
  const { rerender } = render(
    <Button variant="solid" disabled>
      New
    </Button>,
  );
  // Pure-disabled: design swaps the accent fill for an inset/ink-3 treatment.
  expect(screen.getByRole('button')).toHaveClass('bg-surface-inset', 'text-gray-9');
  expect(screen.getByRole('button')).not.toHaveClass('bg-indigo-9');
  // Loading is also `disabled` but must keep the accent fill (design LOADING row).
  rerender(
    <Button variant="solid" loading>
      New
    </Button>,
  );
  const busy = screen.getByRole('button');
  expect(busy).toBeDisabled();
  expect(busy).toHaveClass('bg-indigo-9');
  expect(busy).not.toHaveClass('bg-surface-inset');
});

test('loading shows an animating Spinner, hidden while not loading', () => {
  const { rerender } = render(<Button loading>Creating…</Button>);
  const spinner = screen.getByRole('img', { name: 'Loading' });
  expect(spinner.tagName.toLowerCase()).toBe('svg');
  expect(spinner).toHaveAttribute('width', '12');
  expect(spinner).toHaveAttribute('height', '12');
  expect(spinner).toHaveClass('animate-spin');

  rerender(<Button>Creating…</Button>);
  expect(screen.queryByRole('img', { name: 'Loading' })).toBeNull();
});

test('subtle spends less of the tone than solid', () => {
  const { rerender } = render(<Button variant="subtle">Filter</Button>);
  expect(screen.getByRole('button')).toHaveClass('bg-indigo-3', 'text-indigo-11');
  rerender(<Button variant="solid">Filter</Button>);
  expect(screen.getByRole('button')).toHaveClass('bg-indigo-9', 'text-indigo-contrast');
});

test('chevron is opt-in and comes from the icon registry, not a glyph', () => {
  const { container, rerender } = render(<Button chevron>Row actions</Button>);
  expect(container.querySelector('svg')).not.toBeNull();
  rerender(<Button>Row actions</Button>);
  expect(container.querySelector('svg')).toBeNull();
});
