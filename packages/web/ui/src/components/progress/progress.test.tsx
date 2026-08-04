import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Progress } from './progress';

const bar = () => screen.getByRole('progressbar');
const fill = () => bar().firstElementChild as HTMLElement;

describe('Progress', () => {
  it('draws the value directly as a percentage', () => {
    render(<Progress value={34} />);
    expect(fill().style.width).toBe('34%');
  });

  it('clamps out-of-range values rather than overflowing the track', () => {
    const { rerender } = render(<Progress value={340} />);
    expect(fill().style.width).toBe('100%');
    rerender(<Progress value={-10} />);
    expect(fill().style.width).toBe('0%');
  });

  it('reports the clamped value to assistive tech, on a 0-100 scale', () => {
    const { rerender } = render(<Progress value={34} />);
    expect(bar().getAttribute('aria-valuenow')).toBe('34');
    expect(bar().getAttribute('aria-valuemin')).toBe('0');
    expect(bar().getAttribute('aria-valuemax')).toBe('100');
    // A caller cannot desync the announced value from the drawn one.
    rerender(<Progress value={140} />);
    expect(bar().getAttribute('aria-valuenow')).toBe('100');
  });

  it('is a progressbar, not a meter', () => {
    // `meter` is for a static measurement within a known range — disk usage,
    // a score. This shows how far along something is, which is `progressbar`.
    render(<Progress value={10} />);
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('fills in the tone it is given, defaulting to the accent', () => {
    const { rerender } = render(<Progress value={10} />);
    expect(fill().className).toContain('bg-indigo-9');
    rerender(<Progress value={10} tone="green" />);
    expect(fill().className).toContain('bg-green-9');
    rerender(<Progress value={95} tone="danger" />);
    expect(fill().className).toContain('bg-red-9');
  });

  it('has no opinion about thresholds', () => {
    // Threshold logic lives with whoever knows the quantity. A bare 95% is not
    // dangerous — 95% of a sprint is fine, 95% of a token budget is not.
    render(<Progress value={95} />);
    expect(fill().className).toContain('bg-indigo-9');
    expect(fill().className).not.toContain('bg-red-9');
  });

  it('sizes the bar across three rungs', () => {
    const { rerender } = render(<Progress value={10} size="sm" />);
    expect(bar().className).toContain('h-2');
    rerender(<Progress value={10} size="md" />);
    expect(bar().className).toContain('h-4');
    rerender(<Progress value={10} size="lg" />);
    expect(bar().className).toContain('h-6');
  });

  it('renders label and trailing content, including a numeric zero', () => {
    const { rerender } = render(<Progress value={34} label="$1.06" trailing="148k" />);
    expect(screen.getByText('$1.06')).toBeTruthy();
    expect(screen.getByText('148k')).toBeTruthy();
    rerender(<Progress value={0} label={0} />);
    expect(screen.getByText('0')).toBeTruthy();
    rerender(<Progress value={0} trailing={0} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders no label or trailing span when unset', () => {
    const { container } = render(<Progress value={34} />);
    expect(container.querySelectorAll('span').length).toBe(0);
  });

  it('merges an extra className onto the outer wrapper, not the track', () => {
    const { container } = render(<Progress value={10} className="w-60" />);
    expect(container.firstElementChild!.className).toContain('w-60');
    expect(bar().className).not.toContain('w-60');
  });

  it('lets trackClassName override the track floor and height via twMerge', () => {
    const { rerender } = render(<Progress value={10} />);
    expect(bar().className).toContain('min-w-36');
    rerender(<Progress value={10} trackClassName="min-w-0" />);
    expect(bar().className.split(' ')).toContain('min-w-0');
    expect(bar().className.split(' ')).not.toContain('min-w-36');
    rerender(<Progress value={10} trackClassName="h-8" />);
    expect(bar().className.split(' ')).toContain('h-8');
    expect(bar().className.split(' ')).not.toContain('h-4');
  });
});
