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

  it('defaults to the md rung, sized via the size prop', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('height')).toBe('14');

    const { container: big } = render(<Spinner size="xl" />);
    const bigSvg = big.querySelector('svg')!;
    expect(bigSvg.getAttribute('width')).toBe('20');
    expect(bigSvg.getAttribute('height')).toBe('20');
  });

  it('applies no tone class when tone is unset, inheriting currentColor like Icon', () => {
    const { container } = render(<Spinner />);
    const classes = container.querySelector('svg')!.getAttribute('class')!.split(' ');
    expect(classes.some((c) => c.startsWith('text-'))).toBe(false);
  });

  it('applies an explicit tone', () => {
    const { container } = render(<Spinner tone="secondary" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('text-gray-11');
  });

  it('is labelled for assistive tech (not aria-hidden) since it conveys loading state', () => {
    const { getByRole } = render(<Spinner />);
    expect(getByRole('img', { name: 'Loading' })).toBeTruthy();
  });

  it('accepts a custom label for what is loading', () => {
    const { getByRole } = render(<Spinner label="Fetching results" />);
    expect(getByRole('img', { name: 'Fetching results' })).toBeTruthy();
  });

  it('merges an extra className onto the svg', () => {
    const { container } = render(<Spinner className="text-current" />);
    const classes = container.querySelector('svg')!.getAttribute('class')!.split(' ');
    expect(classes).toContain('text-current');
  });
});
