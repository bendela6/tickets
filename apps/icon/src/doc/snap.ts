import { SNAP_MIN } from './constants';
import type { Geometry, PathSegment } from './types';

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
    case 'circle':
      return { ...geometry, cx: at(geometry.cx), cy: at(geometry.cy), r: at(geometry.r) };
    case 'polyline':
    case 'polygon':
      return {
        ...geometry,
        points: geometry.points.map((point) => ({ x: at(point.x), y: at(point.y) })),
      };
    case 'path':
      return { ...geometry, segments: geometry.segments.map(snapSegment(at)) };
  }
}

/**
 * A path command with the points that are actually *on* it laid on the grid.
 *
 * Control points and arc radii are deliberately left alone. The grid exists so
 * that what gets drawn lands on whole units, and a control point is never
 * drawn: moving one to a grid position puts nothing on the grid and pulls the
 * curve somewhere unrelated to it. An arc's radii are the same argument twice
 * over — they are lengths rather than positions, and SVG grows a radius that
 * cannot reach its endpoint, so a snapped radius would be quietly overruled by
 * the renderer anyway. The endpoints are what the eye lines up, and those do
 * snap.
 */
const snapSegment =
  (at: (value: number) => number) =>
  (segment: PathSegment): PathSegment =>
    segment.c === 'Z' ? segment : { ...segment, x: at(segment.x), y: at(segment.y) };

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
