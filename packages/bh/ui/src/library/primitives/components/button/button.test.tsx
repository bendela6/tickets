import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { focusRing } from '../../../../style';
import { TooltipProvider } from '../../../overlays/components/tooltip';
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

test('outline shares its border-2 weight with Pill outline', () => {
  // button.tsx's own comment: Button `outline` and Pill `outline` must not
  // diverge on a shared variant name. The design spec
  // (docs/design/design-system.html) calls this weight "edges you act on"
  // (inputs, cards, outline controls); Button used to be border-1 while
  // Pill was already border-2 — this pins the reconciled value so
  // the two can't silently drift apart again.
  render(<Button variant="outline">Outline</Button>);
  const button = screen.getByRole('button');
  expect(button).toHaveClass('border-2');
  expect(button).not.toHaveClass('border-1');
});

test('sizes match design height/padding/radius/font-size', () => {
  const { rerender } = render(<Button size="sm">c</Button>);
  expect(screen.getByRole('button')).toHaveClass('h-28', 'px-10', 'rounded-6', 'text-12');
  rerender(<Button size="md">r</Button>);
  expect(screen.getByRole('button')).toHaveClass('h-36', 'px-14', 'rounded-8', 'text-13');
  rerender(<Button size="lg">t</Button>);
  expect(screen.getByRole('button')).toHaveClass('h-44', 'px-[18px]', 'rounded-12', 'text-14');
});

test('the focus halo follows tone, and is the library-wide one', () => {
  // What the halo looks like is `focusRing`'s to decide — this asserts only
  // that the button wears THAT ring, and that it repaints with tone.
  const { rerender } = render(<Button variant="solid">New</Button>);
  expect(screen.getByRole('button').className).toContain(focusRing('indigo'));
  rerender(
    <Button variant="solid" tone="danger">
      Archive
    </Button>,
  );
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
  rerender(
    <Button variant="solid" tone="danger">
      Delete
    </Button>,
  );
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

describe('icon-only', () => {
  test('is named by its label, and draws the glyph from the icon registry', () => {
    const { container } = render(<Button icon="trash" label="Delete row" />);
    const button = screen.getByRole('button', { name: 'Delete row' });
    expect(button).toHaveAttribute('aria-label', 'Delete row');
    // The registry's glyph, hidden from assistive tech: the label names the button.
    const glyph = container.querySelector('svg');
    expect(glyph).not.toBeNull();
    expect(glyph).toHaveAttribute('aria-hidden', 'true');
    expect(button.textContent).toBe('');
  });

  test('is as wide as it is high at every size, xs included', () => {
    const sizes = [
      ['xs', 'h-24', 'w-24', '12'],
      ['sm', 'h-28', 'w-28', '14'],
      ['md', 'h-36', 'w-36', '16'],
      ['lg', 'h-44', 'w-44', '20'],
    ] as const;
    for (const [size, height, width, glyph] of sizes) {
      const { container, unmount } = render(<Button icon="plus" label="Add" size={size} />);
      const button = screen.getByRole('button', { name: 'Add' });
      expect(button).toHaveClass(height, width, 'px-0');
      // The size's own padding is evicted, not stacked under px-0.
      expect(button.className).not.toMatch(/\bpx-(6|10|14|\[18px\])\b/);
      expect(container.querySelector('svg')).toHaveAttribute('width', glyph);
      unmount();
    }
  });

  test('a text button stays as wide as its words', () => {
    render(<Button size="sm">Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('px-10');
    expect(button).not.toHaveClass('w-28');
  });

  test('takes an element for a glyph the registry lacks, drawn as given', () => {
    render(<Button icon={<svg data-testid="own-glyph" />} label="Menu" />);
    expect(screen.getByRole('button', { name: 'Menu' })).toContainElement(
      screen.getByTestId('own-glyph'),
    );
  });

  test('its label shows as a tooltip on hover, with no TooltipProvider above', async () => {
    render(<Button icon="pencil" label="Rename" />);
    await userEvent.hover(screen.getByRole('button', { name: 'Rename' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Rename');
  });

  test('its label shows as a tooltip on keyboard focus, under a TooltipProvider', async () => {
    render(
      <TooltipProvider>
        <Button icon="pencil" label="Rename" />
      </TooltipProvider>,
    );
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Rename' })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Rename');
  });

  test('focus the browser draws no ring for shows no tooltip', async () => {
    // A drawer opened with a click focuses its Close button; a menu closed
    // with a click hands focus back to its trigger. The browser calls neither
    // focus visible, and neither asked for a hint. jsdom's own guess differs
    // from the browsers', so the browser's answer is played here.
    const matches = Element.prototype.matches;
    const spy = vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      return selector === ':focus-visible' ? false : matches.call(this, selector);
    });
    const onFocus = vi.fn();
    render(<Button icon="x" label="Close" onFocus={onFocus} />);
    act(() => {
      screen.getByRole('button', { name: 'Close' }).focus();
    });
    expect(onFocus).toHaveBeenCalledOnce();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('tooltip')).toBeNull();
    spy.mockRestore();
  });

  test('disabled, it still shows its tooltip: the pointer reaches a span around it', async () => {
    const onClick = vi.fn();
    render(<Button icon="arrow-up" label="Move up" disabled onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Move up' });
    expect(button).toBeDisabled();
    const wrapper = button.parentElement;
    expect(wrapper?.tagName.toLowerCase()).toBe('span');
    await userEvent.hover(wrapper as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Move up');
    await userEvent.click(wrapper as HTMLElement);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('loading, it spins in the glyph’s place and keeps its name', () => {
    const { container } = render(<Button icon="refresh" label="Reload" loading />);
    const button = screen.getByRole('button', { name: 'Reload' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('img', { name: 'Loading' })).toHaveClass('animate-spin');
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  test('an aria-label given beside the label still names it', () => {
    render(<Button icon="x" label="Close" aria-label="Close the panel" />);
    expect(screen.getByRole('button', { name: 'Close the panel' })).toBeInTheDocument();
  });

  test('without a label, or with words, an icon is a type error', () => {
    // Compile-time only: the lines below must stay type errors, which
    // `tsc --noEmit` checks. Rendered, they still draw a button.
    const unlabelled = (
      // @ts-expect-error an icon-only button needs a label to name it
      <Button icon="x" />
    );
    const both = (
      // @ts-expect-error an icon-only button takes no words
      <Button icon="x" label="Close">
        Close
      </Button>
    );
    const tiny = (
      // @ts-expect-error `xs` is an icon-only size
      <Button size="xs">Close</Button>
    );
    expect([unlabelled, both, tiny]).toHaveLength(3);
  });
});

test('a text button’s label is its tooltip, not its name', async () => {
  render(<Button label="Saves without closing">Save</Button>);
  const button = screen.getByRole('button', { name: 'Save' });
  expect(button).not.toHaveAttribute('aria-label');
  await userEvent.hover(button);
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Saves without closing');
});
