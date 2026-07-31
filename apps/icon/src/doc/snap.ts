import { SNAP_MIN } from './constants';
import type { Geometry } from './types';

/**
 * Round a value onto the document's grid.
 *
 * Every position and size in the document goes through here — dragged,
 * dragged by a handle, or typed into a field — so the grid means the same
 * thing whichever way a number arrives. Doing it only at the pointer would
 * let the properties panel write values no drag could ever produce.
 */
export function snapTo(value: number, step: number): number {
  if (!Number.isFinite(step) || step < SNAP_MIN) return value;
  const snapped = Math.round(value / step) * step;
  // Re-round to the step's own decimal places: 0.1 steps accumulate binary
  // float error, and `0.30000000000000004` in a document is a bug people can
  // see in an exported file.
  const places = (String(step).split('.')[1] ?? '').length;
  return Number(snapped.toFixed(places));
}

/** Every number in a geometry, on the grid. */
export function snapGeometry(geometry: Geometry, step: number): Geometry {
  const at = (value: number) => snapTo(value, step);
  switch (geometry.kind) {
    case 'rect':
      return {
        ...geometry,
        x: at(geometry.x),
        y: at(geometry.y),
        w: at(geometry.w),
        h: at(geometry.h),
        // Radius is a size like any other, but it must not exceed the box it
        // rounds — a snap that inflated it would bulge the corners.
        radius: Math.min(at(geometry.radius), at(geometry.w) / 2, at(geometry.h) / 2),
      };
    case 'ellipse':
      return {
        ...geometry,
        x: at(geometry.x),
        y: at(geometry.y),
        w: at(geometry.w),
        h: at(geometry.h),
      };
    case 'line':
      return {
        ...geometry,
        x1: at(geometry.x1),
        y1: at(geometry.y1),
        x2: at(geometry.x2),
        y2: at(geometry.y2),
      };
    case 'polygon':
      return {
        ...geometry,
        cx: at(geometry.cx),
        cy: at(geometry.cy),
        r: at(geometry.r),
        // Sides are a count, not a measurement; snapping them to a grid of 8
        // would turn every polygon into an octagon.
        sides: geometry.sides,
      };
  }
}

/**
 * The pitch to draw the grid at, in document units, or null when even the
 * coarsest useful pitch would be denser than the eye can use.
 *
 * The grid follows the snap step rather than a fixed 32 units, so what you see
 * is what a drag will land on. When the step is too fine to draw at the
 * current zoom it doubles until the lines are far enough apart, which keeps a
 * 0.5 grid meaningful at 800% and invisible at 25% instead of solid grey.
 */
export function gridPitch(step: number, scale: number, minPx: number): number | null {
  if (!Number.isFinite(step) || step < SNAP_MIN || scale <= 0) return null;
  let pitch = step;
  // 20 doublings takes any sane step past any sane artboard; the bound is
  // there so a pathological scale cannot spin.
  for (let i = 0; i < 20; i++) {
    if (pitch * scale >= minPx) return pitch;
    pitch *= 2;
  }
  return null;
}
