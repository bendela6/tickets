import { boxCentre, pointsBox, rotatePoint, type Box, type Point } from '../doc/geometry';

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

/**
 * One stored point of a shape defined by points, named by its position in the
 * list. A line's two ends, a polyline's vertices and a polygon's corners are
 * all this: they get these handles *instead* of the eight box ones, because a
 * bounding box cannot express a point — dragging the box's north edge on a
 * horizontal line would be asking to change its thickness, which is a
 * different property with its own control.
 *
 * Indexed rather than enumerated because the list has no fixed length.
 */
export type VertexHandle = `v${number}`;

export type Handle = ResizeHandle | VertexHandle | 'rotate';

export const vertexHandle = (index: number): VertexHandle => `v${index}`;

export const isVertex = (handle: Handle): handle is VertexHandle => /^v\d+$/.test(handle);

export const vertexIndex = (handle: VertexHandle): number => Number(handle.slice(1));

export const RESIZE_HANDLES: readonly ResizeHandle[] = [...CORNER_HANDLES, ...EDGE_HANDLES];

const FIXED_CURSOR: Record<ResizeHandle | 'rotate', string> = {
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

/**
 * Which cursor a handle wears. Every vertex wears the same one, so they are
 * answered by a rule rather than by a record that could never enumerate them.
 */
export function handleCursor(handle: Handle): string {
  return isVertex(handle) ? 'move' : FIXED_CURSOR[handle];
}

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

/**
 * The point that must not move while `handle` is dragged — the opposite corner
 * or edge. Dragging the SE corner pins NW; dragging the E edge pins the W edge.
 */
export function anchorPoint(box: Box, handle: ResizeHandle): Point {
  const x = movesLeft(handle) ? box.x + box.w : movesRight(handle) ? box.x : box.x + box.w / 2;
  const y = movesTop(handle) ? box.y + box.h : movesBottom(handle) ? box.y : box.y + box.h / 2;
  return { x, y };
}

/**
 * Which way each axis grows for this handle: -1, 0 or +1, deliberately NOT
 * normalised. `resizeRotated` multiplies a span by this to get a signed
 * length, and a corner's 1/√2 components would quietly shrink both sides of
 * every diagonal drag by 30%.
 */
function handleSign(handle: ResizeHandle): Point {
  return {
    x: movesLeft(handle) ? -1 : movesRight(handle) ? 1 : 0,
    y: movesTop(handle) ? -1 : movesBottom(handle) ? 1 : 0,
  };
}

/** Rotate a direction vector. Directions turn about the origin, not about a point. */
function rotateVector(vector: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

/** Where the anchor sits relative to the box's centre, for a box of this size. */
function anchorOffset(handle: ResizeHandle, w: number, h: number): Point {
  const x = movesLeft(handle) ? w / 2 : movesRight(handle) ? -w / 2 : 0;
  const y = movesTop(handle) ? h / 2 : movesBottom(handle) ? -h / 2 : 0;
  return { x, y };
}

/**
 * Resize a rotated object with the anchor nailed down.
 *
 * Solved in world space rather than by resizing in the object's frame and
 * patching afterwards. The naive order — rotate the pointer in, resize, rotate
 * back — cannot work on its own, because rotation pivots about the box's
 * centre and resizing *moves* that centre: every other handle then swings
 * around the new pivot, so dragging one corner appears to drag the whole
 * shape.
 *
 * Instead: the anchor's world position is fixed by definition, the new size
 * comes from the pointer-to-anchor vector measured in the object's frame, and
 * the centre is then whatever puts the anchor back where it already was. The
 * dragged handle lands exactly under the pointer and nothing else moves.
 */
export function resizeRotated(
  start: Box,
  handle: ResizeHandle,
  pointer: Point,
  rotation: number,
  constrain: boolean,
): Box {
  const startCentre = boxCentre(start);
  const anchorWorld = rotatePoint(anchorPoint(start, handle), startCentre, rotation);

  // How far the pointer is from the anchor, along the object's own axes.
  const span = rotateVector(
    { x: pointer.x - anchorWorld.x, y: pointer.y - anchorWorld.y },
    -rotation,
  );

  const isCorner = (CORNER_HANDLES as readonly string[]).includes(handle);
  const sign = handleSign(handle);

  // Signed along the handle's own outward direction, so dragging *past* the
  // anchor clamps to a minimum rather than mirroring the box out the far side.
  // `Math.abs` here would make a shape dragged inside-out spring back to full
  // size pointing the other way.
  let w = sign.x === 0 ? start.w : Math.max(MIN_SIDE, span.x * sign.x);
  let h = sign.y === 0 ? start.h : Math.max(MIN_SIDE, span.y * sign.y);

  if (constrain && isCorner && start.w > 0 && start.h > 0) {
    const ratio = start.w / start.h;
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
  }

  // The centre is wherever it has to be for the anchor to stay put.
  const offset = rotateVector(anchorOffset(handle, w, h), rotation);
  const centre = { x: anchorWorld.x - offset.x, y: anchorWorld.y - offset.y };
  return { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
}

/** Unit vector from the centre towards the handle, in the object's own frame. */
export function handleDirection(handle: ResizeHandle): Point {
  const x = movesLeft(handle) ? -1 : movesRight(handle) ? 1 : 0;
  const y = movesTop(handle) ? -1 : movesBottom(handle) ? 1 : 0;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

export interface CircleShape {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Resize a circle, keeping the opposite handle still.
 *
 * A circle is a centre and a radius, so a handle drag has to move both: the
 * anchor stays put and the centre slides to keep it there. Growing about the
 * centre instead would move every handle at once, which is exactly what a drag
 * on one of them should not do.
 *
 * The pointer is projected onto the handle's own axis, so an off-axis wobble
 * does not shrink the shape. A corner sits `r√2` from the centre rather than
 * `r`, so a corner drag divides by that as well as by two.
 */
export function circleResize(
  start: CircleShape,
  handle: ResizeHandle,
  pointer: Point,
  rotation: number,
): CircleShape {
  const centre = { x: start.cx, y: start.cy };
  const direction = handleDirection(handle);
  const isCorner = (CORNER_HANDLES as readonly string[]).includes(handle);
  // A corner is r√2 out; an edge midpoint is r out.
  const reach = isCorner ? start.r * Math.SQRT2 : start.r;

  const anchorLocal = {
    x: centre.x - direction.x * reach,
    y: centre.y - direction.y * reach,
  };
  const anchorWorld = rotatePoint(anchorLocal, centre, rotation);
  const axis = rotateVector(direction, rotation);

  const span = Math.max(
    MIN_SIDE,
    (pointer.x - anchorWorld.x) * axis.x + (pointer.y - anchorWorld.y) * axis.y,
  );

  return {
    // Rotation pivots about the circle's own centre, so the stored centre and
    // the on-screen centre are the same point — no conversion needed.
    cx: anchorWorld.x + (axis.x * span) / 2,
    cy: anchorWorld.y + (axis.y * span) / 2,
    r: isCorner ? span / (2 * Math.SQRT2) : span / 2,
  };
}

/**
 * Stored points, given where they should sit on screen.
 *
 * A shape made of points rotates about the centre of *their* box, and moving
 * one point moves that box — so the pivot the drag is measured against is
 * itself moving. Anything expressed relative to the old pivot swings when it
 * does, which is exactly how the far end of a line used to drift.
 *
 * Solved rather than iterated. Turning the wanted world points back by −θ puts
 * their box centre at a position that does not depend on the pivot at all;
 * turning *that* forward by θ is the pivot the answer must use. For two points
 * this collapses to their midpoint, which is what a line has always used.
 */
export function pointsFromWorld(world: readonly Point[], rotation: number): Point[] {
  const origin = { x: 0, y: 0 };
  const unturned = world.map((point) => rotatePoint(point, origin, -rotation));
  const pivot = rotatePoint(boxCentre(pointsBox(unturned)), origin, rotation);
  return world.map((point) => rotatePoint(point, pivot, -rotation));
}

/**
 * The point a dragged vertex's Shift constraint is measured from: its
 * neighbour in the run. A line has exactly one other point, so this is its far
 * end and Shift means on a line what it always did.
 */
export function vertexAnchor(points: readonly Point[], index: number): Point | null {
  return points[index - 1] ?? points[index + 1] ?? null;
}

/**
 * Where a dragged vertex lands.
 *
 * Shift snaps the segment's *angle* rather than locking an axis: the point is
 * one end of a run, so the useful constraint is the direction that run leaves
 * its neighbour in, and 15° steps give both axes and both diagonals for free.
 */
export function vertexAt(anchor: Point, pointer: Point, constrain: boolean): Point {
  if (!constrain) return pointer;
  const length = Math.hypot(pointer.x - anchor.x, pointer.y - anchor.y);
  const degrees = (Math.atan2(pointer.y - anchor.y, pointer.x - anchor.x) * 180) / Math.PI;
  const snapped = (Math.round(degrees / ROTATE_SNAP) * ROTATE_SNAP * Math.PI) / 180;
  return { x: anchor.x + length * Math.cos(snapped), y: anchor.y + length * Math.sin(snapped) };
}
