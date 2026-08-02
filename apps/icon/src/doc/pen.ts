import type { PathSegment, Point } from './types';

/**
 * A path being drawn, stated as the anchors that were placed rather than as the
 * commands they will become.
 *
 * Two reasons it is not simply a `PathSegment[]` under construction. A command
 * describes the run *into* a point, so the anchor you are currently placing has
 * no command of its own until you decide where the next one goes — an anchor
 * list can hold a half-finished drawing and a command list cannot. And closing
 * changes the commands that were already written: a smooth first anchor only
 * gets its incoming handle when the path comes back round to it, which is a
 * rewrite of the opening `M` in command terms and no change at all here.
 */
export interface PenAnchor {
  point: Point;
  /**
   * The vector from the anchor to the control the curve *leaves* along.
   * Mirrored to give the one it arrives along, which is exactly what makes the
   * curve continuous through the anchor rather than kinked at it.
   *
   * Null is a corner: the curve arrives and leaves along nothing, and the
   * segments either side of it are straight unless their far end says otherwise.
   */
  handle: Point | null;
}

/** The control the curve leaves an anchor along — the anchor itself, at a corner. */
const leaving = (anchor: PenAnchor): Point =>
  anchor.handle
    ? { x: anchor.point.x + anchor.handle.x, y: anchor.point.y + anchor.handle.y }
    : anchor.point;

/** The control the curve arrives at an anchor along: the same reach, mirrored. */
const arriving = (anchor: PenAnchor): Point =>
  anchor.handle
    ? { x: anchor.point.x - anchor.handle.x, y: anchor.point.y - anchor.handle.y }
    : anchor.point;

/**
 * Both ends of an anchor's handle, or null when it has none.
 *
 * Exported for the overlay, which draws the handle as one bar through the
 * anchor rather than as two: the mirroring is the thing being shown, and two
 * separately drawn stubs would look like two handles that happen to line up.
 */
export function handleEnds(anchor: PenAnchor): [Point, Point] | null {
  return anchor.handle ? [arriving(anchor), leaving(anchor)] : null;
}

/**
 * The command running from one anchor to the next.
 *
 * Straight only when *neither* end steers it. A corner followed by a smooth
 * anchor still has to be a cubic — the curve leaves the corner along nothing,
 * which is a control sitting on the corner itself, and arrives at the smooth
 * anchor along its mirrored handle. Writing an `L` there would throw away the
 * handle the drag just pulled out.
 */
function joinSegment(from: PenAnchor, to: PenAnchor): PathSegment {
  if (!from.handle && !to.handle) return { c: 'L', x: to.point.x, y: to.point.y };
  const out = leaving(from);
  const into = arriving(to);
  return { c: 'C', x1: out.x, y1: out.y, x2: into.x, y2: into.y, x: to.point.x, y: to.point.y };
}

/**
 * The anchors as SVG commands.
 *
 * A closed path gets the edge back to its first anchor written out only when
 * something steers it. `Z` already draws that edge — it returns to the point
 * the subpath opened at — so a straight closing edge needs nothing in front of
 * it, and a curved one needs a `C` because `Z` has nowhere to put the controls.
 * That is also why a closed curved path reports one more anchor than it was
 * drawn with: the closing command has to state the point it ends at, and SVG
 * offers no way to say "the one you started from" while also steering there.
 */
export function penSegments(anchors: readonly PenAnchor[], closed: boolean): PathSegment[] {
  const first = anchors[0];
  if (!first) return [];
  const segments: PathSegment[] = [{ c: 'M', x: first.point.x, y: first.point.y }];
  for (let i = 1; i < anchors.length; i++) {
    const from = anchors[i - 1];
    const to = anchors[i];
    if (!from || !to) continue;
    segments.push(joinSegment(from, to));
  }
  if (!closed) return segments;

  const last = anchors.at(-1);
  if (last && last !== first && (last.handle || first.handle)) segments.push(joinSegment(last, first));
  segments.push({ c: 'Z' });
  return segments;
}

/**
 * The one command that would be committed by clicking at `at`, drawn from the
 * last anchor placed — with the `M` in front of it so it can be rendered on its
 * own.
 *
 * Without this the tool is guesswork: every anchor after the first decides a
 * curve whose shape depends on the handle of the anchor before it, and there is
 * no way to know what you are about to get by looking at the anchors alone.
 *
 * The point under the pointer is treated as a corner, because it is: a click
 * places a corner, and only a press *and drag* makes it anything else.
 */
export function penPreview(anchors: readonly PenAnchor[], at: Point): PathSegment[] {
  const last = anchors.at(-1);
  if (!last) return [];
  return [
    { c: 'M', x: last.point.x, y: last.point.y },
    joinSegment(last, { point: at, handle: null }),
  ];
}

/**
 * Whether a click at `at` lands on the first anchor, which is how a path is
 * closed. `reach` is in document units.
 *
 * Refused below two anchors: closing a single point produces `M x y Z`, which
 * draws nothing at all, so a click there is an ordinary second anchor rather
 * than a close that would silently discard the drawing.
 */
export function closesPath(anchors: readonly PenAnchor[], at: Point, reach: number): boolean {
  const first = anchors[0];
  if (!first || anchors.length < 2) return false;
  return Math.hypot(at.x - first.point.x, at.y - first.point.y) <= reach;
}

/**
 * The least a drawn path can be, in anchors.
 *
 * The same floor `removeVertex` holds a path to, and for the same reason: a
 * move with one command after it is the least that draws anything. Below it the
 * pen has nothing to hand over, and leaving a one-anchor object behind would
 * put a shape in the document that renders as nothing and cannot be selected.
 */
export const PEN_FLOOR = 2;

/** Whether the draft is worth keeping when the tool ends. */
export const penIsDrawable = (anchors: readonly PenAnchor[]): boolean =>
  anchors.length >= PEN_FLOOR;
