import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spinner } from './spinner';

describe('Spinner', () => {
  it('renders the arc glyph, animating', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg')!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('class')).toContain('animate-ai-spin');
  });

  it('defaults to 14px, sized via the size prop', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('height')).toBe('14');

    const { container: big } = render(<Spinner size={22} />);
    const bigSvg = big.querySelector('svg')!;
    expect(bigSvg.getAttribute('width')).toBe('22');
    expect(bigSvg.getAttribute('height')).toBe('22');
  });

  it('defaults to the primary tone', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('text-accent');
  });

  it('applies an explicit tone', () => {
    const { container } = render(<Spinner tone="secondary" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('text-ink-2');
  });

  it('is labelled for assistive tech (not aria-hidden) since it conveys loading state', () => {
    const { getByRole } = render(<Spinner />);
    expect(getByRole('img', { name: 'Loading' })).toBeTruthy();
  });

  it('merges an extra className onto the svg', () => {
    const { container } = render(<Spinner className="text-current" />);
    const classes = container.querySelector('svg')!.getAttribute('class')!.split(' ');
    expect(classes).toContain('text-current');
  });
});
