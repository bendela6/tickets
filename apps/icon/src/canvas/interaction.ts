import type { Box, Point } from '../doc/geometry';

/**
 * The eight resize handles and the rotation knob, named by where they sit.
 *
 * Handles act on the object's *unrotated* box, which is also what the design
 * draws: the selection outline is the axis-aligned box, so a handle that
 * resized along the rotated axes would not be where the pointer expects.
 */
export const CORNER_HANDLES = ['nw', 'ne', 'sw', 'se'] as const;
export const EDGE_HANDLES = ['n', 's', 'w', 'e'] as const;
export type CornerHandle = (typeof CORNER_HANDLES)[number];
export type EdgeHandle = (typeof EDGE_HANDLES)[number];
export type ResizeHandle = CornerHandle | EdgeHandle;
export type Handle = ResizeHandle | 'rotate';

export const RESIZE_HANDLES: readonly ResizeHandle[] = [...CORNER_HANDLES, ...EDGE_HANDLES];

/** Which cursor each handle wears. */
export const HANDLE_CURSOR: Record<Handle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  w: 'ew-resize',
  e: 'ew-resize',
  rotate: 'grab',
};

/** Smallest box a resize will produce, in document units. */
const MIN_SIDE = 1;

/** Shift-rotation lands on this many degrees. */
const ROTATE_SNAP = 15;

const movesLeft = (h: ResizeHandle) => h === 'nw' || h === 'sw' || h === 'w';
const movesRight = (h: ResizeHandle) => h === 'ne' || h === 'se' || h === 'e';
const movesTop = (h: ResizeHandle) => h === 'nw' || h === 'ne' || h === 'n';
const movesBottom = (h: ResizeHandle) => h === 'sw' || h === 'se' || h === 's';

/**
 * The box produced by dragging `handle` to `pointer`.
 *
 * `constrain` (Shift) preserves the starting aspect ratio. It applies to
 * corners only: an edge handle moves one axis by definition, and forcing the
 * other to follow would make Shift mean two different things depending on
 * which handle you grabbed.
 */
export function resizeBox(
  start: Box,
  handle: ResizeHandle,
  pointer: Point,
  constrain: boolean,
): Box {
  let left = start.x;
  let right = start.x + start.w;
  let top = start.y;
  let bottom = start.y + start.h;

  if (movesLeft(handle)) left = Math.min(pointer.x, right - MIN_SIDE);
  if (movesRight(handle)) right = Math.max(pointer.x, left + MIN_SIDE);
  if (movesTop(handle)) top = Math.min(pointer.y, bottom - MIN_SIDE);
  if (movesBottom(handle)) bottom = Math.max(pointer.y, top + MIN_SIDE);

  let w = right - left;
  let h = bottom - top;

  const isCorner = (CORNER_HANDLES as readonly string[]).includes(handle);
  if (constrain && isCorner && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    // Take the larger of the two drags as the intent, so the box follows the
    // pointer rather than shrinking to whichever axis moved least.
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
    if (movesLeft(handle)) left = right - w;
    if (movesTop(handle)) top = bottom - h;
  }

  return { x: left, y: top, w, h };
}

/** Degrees clockwise from straight up, which is how the rotation knob reads. */
export function angleFrom(centre: Point, pointer: Point): number {
  const degrees = (Math.atan2(pointer.y - centre.y, pointer.x - centre.x) * 180) / Math.PI + 90;
  return ((degrees % 360) + 360) % 360;
}

export function snapAngle(degrees: number, constrain: boolean): number {
  const normalised = ((degrees % 360) + 360) % 360;
  if (!constrain) return Math.round(normalised);
  return (Math.round(normalised / ROTATE_SNAP) * ROTATE_SNAP) % 360;
}

/**
 * A drag delta, with Shift locking it to whichever axis has moved further.
 * Deciding by the larger component rather than the first one to move means a
 * diagonal drag that turns into a vertical one follows.
 */
export function constrainDelta(dx: number, dy: number, constrain: boolean): Point {
  if (!constrain) return { x: dx, y: dy };
  return Math.abs(dx) >= Math.abs(dy) ? { x: dx, y: 0 } : { x: 0, y: dy };
}

/** Where a handle sits on the box, in document units. */
export function handlePosition(box: Box, handle: ResizeHandle): Point {
  const x = movesLeft(handle) ? box.x : movesRight(handle) ? box.x + box.w : box.x + box.w / 2;
  const y = movesTop(handle) ? box.y : movesBottom(handle) ? box.y + box.h : box.y + box.h / 2;
  return { x, y };
}
