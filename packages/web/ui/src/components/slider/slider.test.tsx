import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { quantise, Slider } from './slider';

describe('quantise', () => {
  it('snaps to the step grid anchored at min, not at zero', () => {
    // A 5-step range starting at 3 must reach 8 and 13 — never 5 or 10.
    expect(quantise(7, 3, 23, 5)).toBe(8);
    expect(quantise(12, 3, 23, 5)).toBe(13);
  });
  it('clamps to the ends', () => {
    expect(quantise(-40, 0, 100, 1)).toBe(0);
    expect(quantise(400, 0, 100, 1)).toBe(100);
  });
  it('keeps fractional steps clean rather than accumulating float error', () => {
    expect(quantise(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
    expect(quantise(0.7, 0, 1, 0.1)).toBe(0.7);
  });
  it('a zero step passes the raw value through, clamped', () => {
    expect(quantise(42.7, 0, 100, 0)).toBe(42.7);
  });
});

describe('Slider', () => {
  const setup = (props: Partial<Parameters<typeof Slider>[0]> = {}) => {
    const onChange = vi.fn();
    render(<Slider label="Opacity" value={50} onChange={onChange} {...props} />);
    return { onChange, slider: screen.getByRole('slider', { name: 'Opacity' }) };
  };

  it('publishes its range and position to assistive tech', () => {
    const { slider } = setup();
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('100');
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
  });

  it('speaks a units-bearing value when one is given', () => {
    const { slider } = setup({ valueText: '50%' });
    expect(slider.getAttribute('aria-valuetext')).toBe('50%');
  });

  it('is reachable by keyboard and moves by step on the arrows', async () => {
    const user = userEvent.setup();
    const { onChange, slider } = setup({ step: 5 });
    await user.tab();
    expect(document.activeElement).toBe(slider);
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(55);
    await user.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith(45);
  });

  it('Home and End jump to the ends', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ min: 10, max: 90 });
    await user.tab();
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith(10);
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith(90);
  });

  it('PageUp and PageDown move a tenth of the range, never less than one step', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ min: 0, max: 100, step: 1 });
    await user.tab();
    await user.keyboard('{PageUp}');
    expect(onChange).toHaveBeenLastCalledWith(60);
  });

  it('ignores keys it does not own, so the surrounding form still works', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('a');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a disabled slider leaves the tab order and reports itself disabled', async () => {
    const user = userEvent.setup();
    const { onChange, slider } = setup({ disabled: true });
    expect(slider.getAttribute('aria-disabled')).toBe('true');
    await user.tab();
    expect(document.activeElement).not.toBe(slider);
    await user.keyboard('{ArrowRight}');
    expect(onChange).not.toHaveBeenCalled();
  });
});
