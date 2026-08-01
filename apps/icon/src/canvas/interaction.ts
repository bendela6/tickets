import {
  anchorControls,
  boxCentre,
  flattenPath,
  pathAnchors,
  pointsBox,
  rotatePoint,
  translateSegments,
  type Box,
  type Point,
} from '../doc/geometry';
import type { PathSegment } from '../doc/types';

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

/**
 * One control point of a path, named by the command that holds it and which of
 * that command's two it is.
 *
 * Not a vertex: a control point is not on the curve, so it is not somewhere the
 * shape passes through and not somewhere another node could be added. Naming it
 * by its command rather than by its anchor's place in the list means the name
 * still points at the same number after a node is added or removed elsewhere.
 */
export type ControlHandle = `c${number}-${1 | 2}`;

export type Handle = ResizeHandle | VertexHandle | ControlHandle | 'rotate';

export const vertexHandle = (index: number): VertexHandle => `v${index}`;

export const isVertex = (handle: Handle): handle is VertexHandle => /^v\d+$/.test(handle);

export const vertexIndex = (handle: VertexHandle): number => Number(handle.slice(1));

const CONTROL_NAME = /^c(\d+)-([12])$/;

export const controlHandle = (segment: number, which: 1 | 2): ControlHandle =>
  `c${segment}-${which}`;

export const isControl = (handle: Handle): handle is ControlHandle => CONTROL_NAME.test(handle);

/** The command and the control number a handle names. */
export function controlParts(handle: ControlHandle): { segment: number; which: 1 | 2 } {
  const match = CONTROL_NAME.exec(handle);
  return { segment: Number(match?.[1] ?? 0), which: match?.[2] === '2' ? 2 : 1 };
}

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
 * Which cursor a handle wears. Every vertex and every control wears the same
 * one, so they are answered by a rule rather than by a record that could never
 * enumerate them.
 */
export function handleCursor(handle: Handle): string {
  if (isVertex(handle) || isControl(handle)) return 'move';
  return FIXED_CURSOR[handle];
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

/** Which of a command's three coordinate pairs a reshape moves. */
interface Shift {
  /** The command's own on-path point. */
  end?: boolean;
  /** `x1`/`y1`. */
  first?: boolean;
  /** `x2`/`y2`. */
  second?: boolean;
}

/** One command with the coordinates `shift` names moved by `d`. */
function shiftSegment(segment: PathSegment, shift: Shift | undefined, d: Point): PathSegment {
  if (!shift) return segment;
  switch (segment.c) {
    case 'Z':
      return segment;
    case 'M':
    case 'L':
    case 'A':
      // An arc's radii are lengths rather than positions: dragging the point it
      // ends at moves the point, and the arc bends to still reach it.
      return shift.end ? { ...segment, x: segment.x + d.x, y: segment.y + d.y } : segment;
    case 'Q':
      return {
        ...segment,
        x1: shift.first ? segment.x1 + d.x : segment.x1,
        y1: shift.first ? segment.y1 + d.y : segment.y1,
        x: shift.end ? segment.x + d.x : segment.x,
        y: shift.end ? segment.y + d.y : segment.y,
      };
    case 'C':
      return {
        ...segment,
        x1: shift.first ? segment.x1 + d.x : segment.x1,
        y1: shift.first ? segment.y1 + d.y : segment.y1,
        x2: shift.second ? segment.x2 + d.x : segment.x2,
        y2: shift.second ? segment.y2 + d.y : segment.y2,
        x: shift.end ? segment.x + d.x : segment.x,
        y: shift.end ? segment.y + d.y : segment.y,
      };
  }
}

const ORIGIN: Point = { x: 0, y: 0 };

/** The point a path is drawn about: the centre of its flattened box. */
const pathPivot = (segments: readonly PathSegment[]): Point =>
  boxCentre(pointsBox(flattenPath(segments).flat()));

/**
 * A path with some of its stored coordinates moved by a screen-space delta, and
 * everything else left exactly where it was on screen.
 *
 * The same problem `pointsFromWorld` solves, for the same reason: a path is
 * turned about the centre of its own flattened box, so moving any coordinate in
 * it — an anchor or a control — moves the pivot every other point is drawn
 * around, and they all swing.
 *
 * Answered with a translation rather than a re-solve, because flattening
 * commutes with translation: sliding every command by `t` slides the pivot by
 * exactly `t`. If the edit drifted the pivot by `Δ`, then translating by
 * `Rθ(Δ) − Δ` puts every untouched point back precisely where it was. What
 * lands under the pointer then falls out on its own — the moved point ends at
 * where it started plus the delta, whatever the pivot did in between — which is
 * why nothing here has to iterate towards an answer.
 */
function movedPath(
  segments: readonly PathSegment[],
  shifts: ReadonlyMap<number, Shift>,
  delta: Point,
  rotation: number,
): PathSegment[] {
  // The drag is measured on screen; the coordinates it is added to are stored
  // unturned, so it is turned back by −θ before it is added to any of them.
  const local = rotatePoint(delta, ORIGIN, -rotation);
  const moved = segments.map((segment, index) => shiftSegment(segment, shifts.get(index), local));
  if (rotation === 0) return moved;

  const before = pathPivot(segments);
  const after = pathPivot(moved);
  const drift = { x: after.x - before.x, y: after.y - before.y };
  const turned = rotatePoint(drift, ORIGIN, rotation);
  return translateSegments(moved, turned.x - drift.x, turned.y - drift.y);
}

/**
 * The path with anchor `anchorIndex` dragged by a screen-space delta.
 *
 * The handles either side of the node travel with it. Leaving them behind does
 * not merely look untidy: the node moves while the points that decide the
 * curve's direction there stay put, so the curve swings round to arrive and
 * leave along headings nobody asked for, and the outline pulls away from the
 * node you are holding. Carrying them keeps the curve's shape and moves only
 * where it sits.
 */
export function movePathAnchor(
  segments: readonly PathSegment[],
  anchorIndex: number,
  delta: Point,
  rotation: number,
): PathSegment[] {
  const anchor = pathAnchors(segments)[anchorIndex];
  if (!anchor) return segments.slice();

  const shifts = new Map<number, Shift>([[anchor.segment, { end: true }]]);
  for (const control of anchorControls(segments, anchor.segment)) {
    const already = shifts.get(control.segment) ?? {};
    shifts.set(control.segment, {
      ...already,
      ...(control.which === 1 ? { first: true } : { second: true }),
    });
  }
  return movedPath(segments, shifts, delta, rotation);
}

/**
 * The path with one control point dragged by a screen-space delta.
 *
 * Only that control moves. A control is how you say what the curve does between
 * two nodes without moving either of them, so an anchor dragged along with it
 * would be answering a question that was not asked.
 */
export function movePathControl(
  segments: readonly PathSegment[],
  segment: number,
  which: 1 | 2,
  delta: Point,
  rotation: number,
): PathSegment[] {
  const shift: Shift = which === 1 ? { first: true } : { second: true };
  return movedPath(segments, new Map([[segment, shift]]), delta, rotation);
}

/**
 * How near a shape's outline a double-click has to land to add a node to it, in
 * CSS pixels.
 *
 * Stated in pixels rather than document units, and divided by the scale at the
 * point of use: how accurately a pointer can be placed is a fact about the
 * pointer, and it must not tighten as you zoom in or loosen as you zoom out.
 */
export const OUTLINE_REACH_PX = 6;

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
