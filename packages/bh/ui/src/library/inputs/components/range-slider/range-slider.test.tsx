import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CONTROL_LADDER } from '../../contract';
import { RangeSlider } from './range-slider';

const low = () => screen.getByRole('slider', { name: /lower bound/ });
const high = () => screen.getByRole('slider', { name: /upper bound/ });

test('each end publishes its own range to assistive tech', () => {
  // The lower thumb cannot go above the upper one, and its announced maximum
  // has to say so rather than claiming the whole track.
  render(<RangeSlider label="Points" value={[2, 5]} onChange={() => {}} min={0} max={10} />);
  expect(low()).toHaveAttribute('aria-valuenow', '2');
  expect(low()).toHaveAttribute('aria-valuemax', '5');
  expect(high()).toHaveAttribute('aria-valuemin', '2');
  expect(high()).toHaveAttribute('aria-valuemax', '10');
});

test('the thumbs never swap — the low one pins at the high one', async () => {
  // A range that reorders itself under the pointer means the thumb you grabbed
  // is no longer the thumb you are moving.
  const onChange = vi.fn();
  render(<RangeSlider label="Points" value={[2, 5]} onChange={onChange} min={0} max={10} />);
  fireEvent.keyDown(low(), { key: 'End' });
  expect(onChange).toHaveBeenLastCalledWith([5, 5]);
});

test('the high thumb pins at the low one, from the other side', () => {
  const onChange = vi.fn();
  render(<RangeSlider label="Points" value={[2, 5]} onChange={onChange} min={0} max={10} />);
  fireEvent.keyDown(high(), { key: 'Home' });
  expect(onChange).toHaveBeenLastCalledWith([2, 2]);
});

test('a collided pair keeps the held thumb on top, so it can be reopened', () => {
  // Otherwise a range closed to zero traps whichever thumb rendered first.
  render(<RangeSlider label="Points" value={[3, 3]} onChange={() => {}} min={0} max={10} />);
  fireEvent.focus(low());
  expect(low().className).toContain('z-20');
  expect(high().className).toContain('z-10');
});

test('shift moves ten steps, matching the single slider', () => {
  const onChange = vi.fn();
  render(
    <RangeSlider label="Points" value={[10, 90]} onChange={onChange} min={0} max={100} step={1} />,
  );
  fireEvent.keyDown(low(), { key: 'ArrowRight', shiftKey: true });
  expect(onChange).toHaveBeenLastCalledWith([20, 90]);
});

test('only the span between the thumbs is filled', () => {
  // A range means the distance, not the distance from zero.
  const { container } = render(
    <RangeSlider label="Points" value={[20, 60]} onChange={() => {}} min={0} max={100} />,
  );
  const fill = container.querySelector('[aria-hidden]') as HTMLElement;
  expect(fill.style.left).toBe('20%');
  expect(fill.style.width).toBe('40%');
});

test('read-only keeps both tab stops and refuses the keyboard', () => {
  const onChange = vi.fn();
  render(<RangeSlider label="Points" value={[2, 5]} onChange={onChange} readOnly />);
  expect(low()).toHaveAttribute('aria-readonly', 'true');
  expect(low().getAttribute('tabindex')).toBe('0');
  fireEvent.keyDown(low(), { key: 'ArrowRight' });
  expect(onChange).not.toHaveBeenCalled();
});

test('disabled leaves the tab order', () => {
  render(<RangeSlider label="Points" value={[2, 5]} onChange={() => {}} disabled />);
  expect(low().getAttribute('tabindex')).toBe('-1');
});

/** jsdom gives the track no width, and a press on it reads none: 100px, from 0. */
function stubTrack() {
  const track = low().parentElement as HTMLElement;
  track.getBoundingClientRect = () => {
    return {
      left: 0,
      right: 100,
      width: 100,
      top: 0,
      bottom: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {},
    };
  };
  return track;
}

test('a press beside a closed range moves the end that can go that way', () => {
  // With both ends on one value, either is as near as the other, and the low
  // end can't move up: a press above them is the high end's.
  const onChange = vi.fn();
  render(<RangeSlider label="Points" value={[5, 5]} onChange={onChange} min={0} max={10} />);
  const track = stubTrack();
  fireEvent.pointerDown(track, { clientX: 80, pointerId: 1 });
  expect(onChange).toHaveBeenLastCalledWith([5, 8]);
  fireEvent.pointerDown(track, { clientX: 20, pointerId: 1 });
  expect(onChange).toHaveBeenLastCalledWith([2, 5]);
});

test('takes size, on the ladder Slider and the toggle marks use', () => {
  const { rerender } = render(
    <RangeSlider label="Points" value={[2, 5]} onChange={() => {}} size="xs" />,
  );
  expect(low().className).toContain(CONTROL_LADDER.xs.mark);
  rerender(<RangeSlider label="Points" value={[2, 5]} onChange={() => {}} size="lg" />);
  expect(low().className).toContain(CONTROL_LADDER.lg.mark);
  expect(high().className).toContain(CONTROL_LADDER.lg.mark);
  expect(low().parentElement?.className).toContain('h-8');
});
