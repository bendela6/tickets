import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dot } from './dot';

afterEach(cleanup);

describe('Dot', () => {
  it('carries the given colour on a custom property, not a class', () => {
    // A runtime colour CANNOT be a class: Tailwind only emits variables for
    // names it can see in source, so `bg-${hue}-9` built at runtime resolves
    // to nothing and invalidates the declaration.
    const { container } = render(<Dot color="var(--color-blue-9)" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue('--dot-color')).toBe('var(--color-blue-9)');
    expect(el.className).toContain('bg-(--dot-color)');
  });

  it('hollow draws a ring and no fill', () => {
    const { container } = render(<Dot color="var(--color-blue-9)" hollow />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('border-1');
    expect(el.className).not.toContain('bg-(--dot-color)');
    // The colour must not leak through as a fill via the custom property.
    expect(el.style.getPropertyValue('--dot-color')).toBe('');
  });

  it('is decorative, so it is hidden from assistive tech', () => {
    const { container } = render(<Dot color="red" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden');
  });
});
