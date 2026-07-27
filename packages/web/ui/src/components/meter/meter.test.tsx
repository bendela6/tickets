import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Meter } from './meter';

describe('Meter', () => {
  it('computes fill width as a percentage of max', () => {
    render(<Meter value={34} max={100} />);
    const fill = screen.getByRole('meter').firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('34%');
  });

  it('clamps width to 100% when value exceeds max', () => {
    render(<Meter value={340} max={100} />);
    const fill = screen.getByRole('meter').firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('clamps width to 0% when value is negative', () => {
    render(<Meter value={-10} max={100} />);
    const fill = screen.getByRole('meter').firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('exposes role="meter" with correct aria value attributes', () => {
    render(<Meter value={34} max={200} />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('34');
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('200');
  });

  it('defaults to the primary tone fill below any threshold', () => {
    render(<Meter value={10} max={100} />);
    const fill = screen.getByRole('meter').firstElementChild as HTMLElement;
    expect(fill.className).toContain('bg-indigo-9');
  });

  it('respects an explicit tone below any threshold', () => {
    render(<Meter value={10} max={100} tone="green" />);
    const fill = screen.getByRole('meter').firstElementChild as HTMLElement;
    expect(fill.className).toContain('bg-green-9');
  });

  it('switches the fill to the warning tone at warnAt', () => {
    render(<Meter value={80} max={100} warnAt={80} />);
    const fill = screen.getByRole('meter').firstElementChild as HTMLElement;
    expect(fill.className).toContain('bg-orange-9');
  });

  it('does not warn below warnAt', () => {
    render(<Meter value={79} max={100} warnAt={80} />);
    const fill = screen.getByRole('meter').firstElementChild as HTMLElement;
    expect(fill.className).not.toContain('bg-orange-9');
  });

  it('switches the fill to the danger tone at dangerAt', () => {
    render(<Meter value={95} max={100} dangerAt={95} />);
    const fill = screen.getByRole('meter').firstElementChild as HTMLElement;
    expect(fill.className).toContain('bg-red-9');
  });

  it('prefers danger over warn when both thresholds are crossed', () => {
    render(<Meter value={99} max={100} warnAt={80} dangerAt={95} />);
    const fill = screen.getByRole('meter').firstElementChild as HTMLElement;
    expect(fill.className).toContain('bg-red-9');
    expect(fill.className).not.toContain('bg-orange-9');
  });

  it('renders label and trailing content', () => {
    render(<Meter value={34} max={100} label="$1.06" trailing="148k" />);
    expect(screen.getByText('$1.06')).toBeTruthy();
    expect(screen.getByText('148k')).toBeTruthy();
  });

  it('renders a numeric 0 label instead of swallowing it', () => {
    render(<Meter value={0} max={100} label={0} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders a numeric 0 trailing instead of swallowing it', () => {
    render(<Meter value={0} max={100} trailing={0} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders no label or trailing span when unset', () => {
    const { container } = render(<Meter value={34} max={100} />);
    expect(container.querySelectorAll('span').length).toBe(0);
  });

  it('renders a value of 0 correctly with 0% width', () => {
    render(<Meter value={0} max={100} />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
    const fill = meter.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('merges an extra className onto the outer wrapper', () => {
    const { container } = render(<Meter value={10} max={100} className="w-15" />);
    expect(container.firstElementChild!.className).toContain('w-15');
    expect(screen.getByRole('meter').className).not.toContain('w-15');
  });

  it('keeps the default min-w-9 track floor when trackClassName is unset', () => {
    render(<Meter value={10} max={100} />);
    expect(screen.getByRole('meter').className).toContain('min-w-9');
  });

  it('lets trackClassName override the track min-width floor via twMerge', () => {
    render(<Meter value={10} max={100} trackClassName="min-w-0" />);
    const trackClasses = screen.getByRole('meter').className.split(' ');
    expect(trackClasses).toContain('min-w-0');
    expect(trackClasses).not.toContain('min-w-9');
  });

  it('lets trackClassName override the track fixed height via twMerge', () => {
    render(<Meter value={10} max={100} trackClassName="h-2" />);
    const trackClasses = screen.getByRole('meter').className.split(' ');
    expect(trackClasses).toContain('h-2');
    expect(trackClasses).not.toContain('h-1');
  });
});
