import { fireEvent, render, screen } from '@testing-library/react';
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

  const track = (slider: HTMLElement) => slider.firstElementChild as HTMLElement;

  /**
   * jsdom gives every element a zero-width rect, and the pointer path bails on
   * exactly that — so an un-stubbed drag test passes for the wrong reason. The
   * rect is read fresh on every press, so stubbing after render is enough.
   */
  function stubTrack(slider: HTMLElement, width = 200) {
    track(slider).getBoundingClientRect = () =>
      ({
        left: 0,
        right: width,
        width,
        top: 0,
        bottom: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;
  }

  // fireEvent rather than user-event for the pointer: user-event refuses to
  // interact with an element under `pointer-events: none`, which read-only
  // deliberately is — it would report the CSS instead of the handler guard,
  // and the guard is the half that has to hold when the CSS is overridden.
  const press = (slider: HTMLElement, clientX: number) =>
    fireEvent.pointerDown(slider, { clientX, pointerId: 1 });

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

  it('a press on the track moves the value to where it landed', () => {
    const { onChange, slider } = setup();
    stubTrack(slider);
    press(slider, 150);
    expect(onChange).toHaveBeenLastCalledWith(75);
  });

  it('read-only refuses the pointer', () => {
    const { onChange, slider } = setup({ readOnly: true });
    stubTrack(slider);
    press(slider, 150);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('read-only refuses the keyboard while keeping its tab stop', async () => {
    const user = userEvent.setup();
    const { onChange, slider } = setup({ readOnly: true });
    // The point of read-only over disabled: the value is still reachable, so a
    // screen-reader user can still hear it.
    await user.tab();
    expect(document.activeElement).toBe(slider);
    await user.keyboard('{ArrowRight}{ArrowLeft}{Home}{End}{PageUp}');
    expect(onChange).not.toHaveBeenCalled();
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
  });

  it('read-only says so with aria-readonly and never with aria-disabled', () => {
    const { slider } = setup({ readOnly: true });
    expect(slider.getAttribute('aria-readonly')).toBe('true');
    // Claiming disabled would tell assistive tech to skip a value that still
    // counts — and HTML's own `readonly` cannot reach this role, which is why
    // the ARIA attribute carries it.
    expect(slider).not.toHaveAttribute('aria-disabled');
    expect(slider.getAttribute('tabindex')).toBe('0');
  });

  it('claims neither state when it is editable', () => {
    const { slider } = setup();
    expect(slider).not.toHaveAttribute('aria-readonly');
    expect(slider).not.toHaveAttribute('aria-disabled');
  });

  it('takes an id, so a description or a heading can point at it', () => {
    const { slider } = setup({ id: 'opacity-slider' });
    expect(slider.id).toBe('opacity-slider');
  });

  it('sizes the track and the row it sits in across three rungs', () => {
    // `lg` is the rung the slider was missing — a 44px field beside it had
    // nothing to match. It is here so it cannot quietly fall out again.
    const rungs = [
      { size: 'sm', track: 'h-3', row: 'h-16' },
      { size: 'md', track: 'h-4', row: 'h-20' },
      { size: 'lg', track: 'h-5', row: 'h-24' },
    ] as const;

    for (const rung of rungs) {
      const { unmount } = render(
        <Slider label={rung.size} value={50} onChange={() => {}} size={rung.size} />,
      );
      const slider = screen.getByRole('slider', { name: rung.size });
      expect(slider).toHaveClass(rung.row);
      expect(track(slider)).toHaveClass(rung.track);
      unmount();
    }
  });

  it('snaps a press onto a grid anchored at a non-zero min', () => {
    // 3/10/17/…/73. A grid anchored at zero would answer 35 or 42 here; only an
    // anchored one lands on 38.
    const { onChange, slider } = setup({ min: 3, max: 73, step: 7, value: 38 });
    stubTrack(slider);
    press(slider, 100);
    expect(onChange).toHaveBeenLastCalledWith(38);
  });

  it('keeps the arrows on that same grid', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ min: 3, max: 73, step: 7, value: 38 });
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(45);
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(31);
  });
});
