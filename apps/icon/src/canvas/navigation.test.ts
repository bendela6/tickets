import { describe, expect, it } from 'vitest';
import { ZOOM_MAX, ZOOM_MIN } from '../doc/constants';
import { wheelIntent, zoomByWheel } from './navigation';

const wheel = (over: Partial<Parameters<typeof wheelIntent>[0]>) => ({
  deltaX: 0,
  deltaY: 0,
  deltaMode: 0,
  ctrlKey: false,
  metaKey: false,
  ...over,
});

describe('wheelIntent', () => {
  it('zooms on a mouse wheel notch', () => {
    expect(wheelIntent(wheel({ deltaY: -100 }))).toBe('zoom');
    expect(wheelIntent(wheel({ deltaY: 120 }))).toBe('zoom');
  });

  it('pans on a two-finger trackpad scroll', () => {
    // Sideways at all, or a fractional or small vertical amount: a wheel
    // cannot produce any of those.
    expect(wheelIntent(wheel({ deltaX: 12, deltaY: 0 }))).toBe('pan');
    expect(wheelIntent(wheel({ deltaY: -3.5 }))).toBe('pan');
    expect(wheelIntent(wheel({ deltaY: 8 }))).toBe('pan');
  });

  it('zooms on a pinch, which arrives as ctrl + wheel', () => {
    expect(wheelIntent(wheel({ deltaY: -4.5, ctrlKey: true }))).toBe('zoom');
  });

  it('lets the modifier override the guess in either direction', () => {
    // The heuristic can misread a device; holding the key is the way out.
    expect(wheelIntent(wheel({ deltaX: 40, deltaY: 2, metaKey: true }))).toBe('zoom');
  });

  it('zooms when the wheel reports lines or pages rather than pixels', () => {
    expect(wheelIntent(wheel({ deltaY: -3, deltaMode: 1 }))).toBe('zoom');
  });
});

describe('zoomByWheel', () => {
  it('keeps the same ratio per notch at every magnification', () => {
    // The point of a multiplicative step: one notch feels identical at 20%
    // and at 800%, which an additive step never does.
    const low = zoomByWheel(20, -100) / 20;
    const high = zoomByWheel(800, -100) / 800;
    expect(low).toBeCloseTo(high, 9);
  });

  it('goes up on a negative delta, which is the wheel pushed forward', () => {
    expect(zoomByWheel(100, -100)).toBeGreaterThan(100);
    expect(zoomByWheel(100, 100)).toBeLessThan(100);
  });

  it('reverses exactly, so a notch back lands where it started', () => {
    expect(zoomByWheel(zoomByWheel(137, -100), 100)).toBeCloseTo(137, 9);
  });

  it('holds the range', () => {
    expect(zoomByWheel(ZOOM_MAX, -100)).toBe(ZOOM_MAX);
    expect(zoomByWheel(ZOOM_MIN, 100)).toBe(ZOOM_MIN);
  });

  it('does not quantise to whole percent', () => {
    // Rounding here would make one notch a tenth of the range at 10%.
    expect(Number.isInteger(zoomByWheel(100, -37))).toBe(false);
  });
});
