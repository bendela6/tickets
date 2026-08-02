import {
  useCallback,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { objectId } from '../doc/defaults';
import {
  aimLine,
  bounds,
  boxCentre,
  centreOf,
  controlPointAt,
  hitTest,
  pointsBox,
  rotatePoint,
  rotatedBounds,
  translate,
  unionBox,
  vertexPoints,
  type Box,
  type Point,
} from '../doc/geometry';
import { closesPath } from '../doc/pen';
import { selectedObject, type Action, type EditorState, type GeometryEdit } from '../doc/store';
import type { Geometry, IconObject, PathSegment } from '../doc/types';
import {
  angleFrom,
  circleResize,
  constrainDelta,
  controlParts,
  isControl,
  isVertex,
  MARQUEE_MIN_PX,
  movePathAnchor,
  movePathControl,
  OUTLINE_REACH_PX,
  PEN_PULL_PX,
  pointsFromWorld,
  resizeRotated,
  snapAngle,
  vertexAnchor,
  vertexAt,
  vertexIndex,
  type CircleShape,
  type Handle,
  type ResizeHandle,
} from './interaction';

const roundCircle = (shape: CircleShape): CircleShape => ({
  cx: Math.round(shape.cx),
  cy: Math.round(shape.cy),
  r: Math.round(shape.r),
});

const roundPoint = (point: Point): Point => ({ x: Math.round(point.x), y: Math.round(point.y) });

type Gesture =
  /**
   * A move, of one object or of a whole selection.
   *
   * `starts` is every object being carried with the geometry it had when the
   * press landed, captured once and never re-read. That is the same absolute
   * rule the single case has always kept, widened: each move recomputes every
   * one of them from the start it was captured with, so a selection dragged in
   * a circle comes back exactly where it began. Reading the current geometry
   * each frame and adding a step to it would drift, and drift is visible.
   *
   * A locked object never gets into `starts` — it is left out at the press,
   * so the rest of the selection moves around it.
   */
  | {
      mode: 'move';
      starts: readonly GeometryEdit[];
      startPoint: Point;
      startBox: Box;
      /** The ghost's rotation. Zero for several, whose combined box has none. */
      rotation: number;
      /** What the status slot calls this move, decided once at the press. */
      label: string;
      /**
       * The object to collapse the selection to if the press turns out to be a
       * click. Set only when the press landed inside a selection of several,
       * which is the one case where a plain press does not replace it outright.
       */
      collapse: string | null;
      /** Whether the pointer has actually moved the shapes anywhere yet. */
      moved: boolean;
    }
  /**
   * A rubber band, opened by a press on empty canvas. What it catches is
   * decided on the release rather than as it is dragged: a band that has caught
   * and released a shape on the way past should leave nothing behind.
   */
  | {
      mode: 'marquee';
      startPoint: Point;
      /** Where the press went down, in CSS pixels — the threshold is measured there. */
      startClient: Point;
      /** Shift: the band adds to the selection instead of replacing it. */
      additive: boolean;
      moved: boolean;
    }
  | {
      mode: 'resize';
      id: string;
      handle: ResizeHandle;
      startBox: Box;
      rotation: number;
      /** Set only for a circle, which resizes as a centre and a radius. */
      startCircle?: CircleShape;
    }
  /**
   * `startWorld` holds every one of the shape's points, captured once when the
   * drag starts and never recomputed. Reading the others' positions from the
   * document each frame would read them through a pivot that the drag itself
   * is moving.
   *
   * `startSegments` is the same capture for a path, which is rewritten command
   * by command rather than as a list of points.
   */
  | {
      mode: 'vertex';
      id: string;
      index: number;
      rotation: number;
      startWorld: Point[];
      startSegments?: readonly PathSegment[];
    }
  /**
   * A control point. Its own mode because it is the one drag that must leave
   * every node exactly where it is — including the node it hangs off.
   */
  | {
      mode: 'control';
      id: string;
      segment: number;
      which: 1 | 2;
      rotation: number;
      startWorld: Point;
      startSegments: readonly PathSegment[];
    }
  /**
   * `line` is set when the object being turned is a line, which stores no
   * rotation of its own — turning it rewrites its endpoints instead.
   */
  | {
      mode: 'rotate';
      id: string;
      centre: Point;
      line?: Extract<Geometry, { kind: 'line' }>;
    };

/**
 * What the pen overlay needs that the store does not hold: where the pointer is
 * and whether the press that placed the last anchor is still down.
 *
 * Local to the canvas because it is view state in the strictest sense — one
 * overlay reads it, it is meaningless the moment the tool ends, and nothing
 * outside this file can act on it. The anchors themselves are in the store,
 * where the keyboard and the rail can see them.
 */
export interface PenChrome {
  /** Where the pointer is, in document units. */
  at: Point;
  /**
   * A press is pulling a handle out of the last anchor, so the pointer is
   * steering a curve rather than aiming at the next anchor — and there is
   * nothing to preview.
   */
  pulling: boolean;
}

export interface DragChrome {
  /** Where the object started, so the ghost can be drawn there. */
  origin: Box;
  /** Where it is now. */
  current: Box;
  /** Movement so far, in document units. */
  delta: Point;
  /** The object's rotation, so the ghost turns with it. */
  rotation: number;
}

/**
 * Direct manipulation on the artboard.
 *
 * Every gesture is absolute rather than incremental: it remembers the geometry
 * and the pointer position it started from, and each move recomputes from
 * those. Accumulating per-move deltas would drift, and the drift is visible —
 * a shape dragged in a circle should come back to where it began.
 */
export function useArtboardPointer({
  state,
  dispatch,
  scale,
  surfaceRef,
  onDraggingChange,
}: {
  state: EditorState;
  dispatch: (action: Action) => void;
  /** Document units to CSS pixels. */
  scale: number;
  surfaceRef: RefObject<HTMLElement | null>;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const gesture = useRef<Gesture | null>(null);
  const [chrome, setChrome] = useState<DragChrome | null>(null);
  /** The rubber band as it stands, in document units. Null when there is none. */
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [penChrome, setPenChrome] = useState<PenChrome | null>(null);
  /**
   * Where the press that placed the current anchor went down, in CSS pixels.
   * The threshold is a distance the *pointer* travelled, so it is measured
   * against the raw press rather than against the snapped anchor it produced.
   */
  const penPress = useRef<{ x: number; y: number; pulling: boolean } | null>(null);

  const pointOf = useCallback(
    (event: { clientX: number; clientY: number }): Point | null => {
      const surface = surfaceRef.current;
      if (!surface) return null;
      const box = surface.getBoundingClientRect();
      return { x: (event.clientX - box.left) / scale, y: (event.clientY - box.top) / scale };
    },
    [scale, surfaceRef],
  );

  const objectById = (id: string): IconObject | undefined =>
    state.doc.objects.find((object) => object.id === id);

  const begin = (event: PointerEvent, next: Gesture) => {
    gesture.current = next;
    event.currentTarget.setPointerCapture(event.pointerId);
    onDraggingChange(true);
  };

  /**
   * A press while the pen is active.
   *
   * The anchor is placed on the press rather than on the release, which is what
   * lets a drag mean anything at all: by the time the pointer moves there is
   * already an anchor for it to pull a handle out of, and a click is simply a
   * drag that never went anywhere.
   */
  const penDown = (event: PointerEvent, point: Point) => {
    // Landing on the first anchor is how a path is told to close. Tested before
    // anything else, because otherwise it would place an anchor on top of it.
    if (closesPath(state.pen, point, OUTLINE_REACH_PX / scale)) {
      dispatch({ type: 'penEnd', close: true });
      setPenChrome(null);
      return;
    }
    penPress.current = { x: event.clientX, y: event.clientY, pulling: false };
    dispatch({ type: 'penPoint', at: point });
    setPenChrome({ at: point, pulling: false });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  /** Pointer movement while the pen is active: steering a handle, or aiming. */
  const penMove = (event: PointerEvent, point: Point) => {
    const press = penPress.current;
    // Latched rather than re-tested each move: a drag that wanders back inside
    // the threshold is still a drag, and letting it flip back to a click would
    // strand the handle at whatever it happened to be.
    if (press && !press.pulling) {
      press.pulling = Math.hypot(event.clientX - press.x, event.clientY - press.y) > PEN_PULL_PX;
    }
    if (press?.pulling) dispatch({ type: 'penHandle', at: point });
    setPenChrome({ at: point, pulling: press?.pulling === true });
  };

  const onPointerDown = (event: PointerEvent) => {
    // The middle button pans the canvas and the right one is the context menu.
    // Only the primary button draws.
    if (event.button !== 0) return;
    const point = pointOf(event);
    if (!point) return;

    // The pen sits in front of everything below it. While it is active the
    // artboard is a surface being drawn on rather than a set of objects being
    // picked from, so nothing here hit-tests, selects or moves anything.
    if (state.tool === 'pen') {
      penDown(event, point);
      return;
    }

    const hit = hitTest(state.doc.objects, point);

    if (!hit) {
      // A press on empty canvas opens a rubber band. Nothing is deselected
      // yet: the release decides, because only the band's own size can say
      // whether this was a marquee or a click on the background.
      gesture.current = {
        mode: 'marquee',
        startPoint: point,
        startClient: { x: event.clientX, y: event.clientY },
        additive: event.shiftKey,
        moved: false,
      };
      setMarquee({ x: point.x, y: point.y, w: 0, h: 0 });
      // Not `begin`: `dragging` dims the rails and prints the modifiers a move
      // takes, and a band takes none of them.
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    // Shift adds the shape to the selection or takes it out again, and that
    // press is the whole gesture — a shift-click that also picked the shape up
    // would answer a question nobody asked.
    if (event.shiftKey) {
      dispatch({ type: 'toggleSelect', id: hit.id });
      return;
    }

    // Pressing a member of a several-object selection keeps that selection:
    // this press is how the whole group gets picked up. Pressing anything else
    // replaces it — which is also what ends node editing.
    const group = state.selectedIds.size > 1 && state.selectedIds.has(hit.id);
    if (!group) dispatch({ type: 'selectObject', id: hit.id });

    // Locked means it will not move, not that it has left the document: it
    // still selects, so it can be unlocked from the rail.
    if (hit.locked) return;

    // Alt duplicates: the copy is what you drag away, leaving the original in
    // place. The new id is derived rather than read back from state, which
    // has not updated yet. One object only — duplicating a whole selection is
    // the same question as grouping one, and is answered with it.
    let target = hit;
    if (event.altKey && !group) {
      dispatch({ type: 'duplicateObject', id: hit.id });
      target = { ...hit, id: objectId(hit.geometry.kind, state.sequence + 1) };
    }

    // Every geometry the drag will recompute from, taken here and only here.
    // A locked object is left out rather than refused move by move, so the rest
    // of the selection travels around it.
    const carried = group
      ? state.doc.objects.filter((o) => state.selectedIds.has(o.id) && !o.locked)
      : [target];
    const starts: GeometryEdit[] = carried.map((o) => ({ id: o.id, geometry: o.geometry }));
    // A selection of nothing but locked objects has nothing to pick up.
    if (starts.length === 0) return;

    // The ghost is drawn round one object at its own angle, or round the lot
    // upright: a combined box has no rotation of its own to be drawn at.
    const startBox = group
      ? (unionBox(carried.map(rotatedBounds)) ?? bounds(target))
      : bounds(target);
    begin(event, {
      mode: 'move',
      starts,
      startPoint: point,
      startBox,
      rotation: group ? 0 : target.rotation,
      label: group ? `move ${starts.length} objects` : `move ${target.name}`,
      collapse: group ? hit.id : null,
      moved: false,
    });
    setChrome({
      origin: startBox,
      current: startBox,
      delta: { x: 0, y: 0 },
      rotation: group ? 0 : target.rotation,
    });
  };

  const onHandleDown = (handle: Handle, event: PointerEvent) => {
    // The overlay sits above the artboard; without this the artboard's own
    // handler would run too and start a move behind the resize.
    event.stopPropagation();
    // Handles only ever belong to a single selection — resizing, rotating and
    // node editing are all statements about one shape — so this reads the
    // single-selection accessor rather than picking one out of a set.
    const object = selectedObject(state);
    if (!object || object.locked) return;

    if (handle === 'rotate') {
      begin(event, {
        mode: 'rotate',
        id: object.id,
        centre: boxCentre(bounds(object)),
        line: object.geometry.kind === 'line' ? object.geometry : undefined,
      });
      return;
    }
    if (isVertex(handle)) {
      const startWorld = vertexPoints(object);
      if (startWorld.length === 0) return;
      const index = vertexIndex(handle);
      // Pressing a node selects it. That is what brings its control handles on
      // screen and what Backspace then acts on, and it costs the drag nothing:
      // a press that turns out to be a click has still selected the node.
      dispatch({ type: 'selectNode', index });
      begin(event, {
        mode: 'vertex',
        id: object.id,
        index,
        rotation: object.rotation,
        startWorld,
        ...(object.geometry.kind === 'path' ? { startSegments: object.geometry.segments } : {}),
      });
      return;
    }
    if (isControl(handle)) {
      const g = object.geometry;
      if (g.kind !== 'path') return;
      const { segment, which } = controlParts(handle);
      const stored = controlPointAt(g.segments, segment, which);
      if (!stored) return;
      begin(event, {
        mode: 'control',
        id: object.id,
        segment,
        which,
        rotation: object.rotation,
        startWorld: rotatePoint(stored, centreOf(object), object.rotation),
        startSegments: g.segments,
      });
      return;
    }
    begin(event, {
      mode: 'resize',
      id: object.id,
      handle,
      startBox: bounds(object),
      rotation: object.rotation,
      ...(object.geometry.kind === 'circle'
        ? {
            startCircle: {
              cx: object.geometry.cx,
              cy: object.geometry.cy,
              r: object.geometry.r,
            },
          }
        : {}),
    });
  };

  const onPointerMove = (event: PointerEvent) => {
    if (state.tool === 'pen') {
      const at = pointOf(event);
      if (at) penMove(event, at);
      return;
    }
    const active = gesture.current;
    if (!active) return;
    const point = pointOf(event);
    if (!point) return;

    if (active.mode === 'marquee') {
      // Latched, the way the pen's pull is: a band that wandered out and back
      // inside the threshold is still a band, not a click that changed its mind.
      if (
        Math.hypot(event.clientX - active.startClient.x, event.clientY - active.startClient.y) >
        MARQUEE_MIN_PX
      ) {
        active.moved = true;
      }
      setMarquee(pointsBox([active.startPoint, point]));
      return;
    }

    if (active.mode === 'move') {
      const delta = constrainDelta(
        point.x - active.startPoint.x,
        point.y - active.startPoint.y,
        event.shiftKey,
      );
      const dx = Math.round(delta.x);
      const dy = Math.round(delta.y);
      if (dx !== 0 || dy !== 0) active.moved = true;
      dispatch({
        type: 'setGeometries',
        edits: active.starts.map((start) => ({
          id: start.id,
          geometry: translate(start.geometry, dx, dy),
        })),
        label: active.label,
        at: event.timeStamp,
      });
      setChrome({
        origin: active.startBox,
        current: { ...active.startBox, x: active.startBox.x + dx, y: active.startBox.y + dy },
        delta: { x: dx, y: dy },
        rotation: active.rotation,
      });
      return;
    }

    const object = objectById(active.id);
    if (!object) return;

    if (active.mode === 'control') {
      const g = object.geometry;
      if (g.kind !== 'path') return;
      dispatch({
        type: 'setGeometry',
        id: active.id,
        geometry: {
          ...g,
          segments: movePathControl(
            active.startSegments,
            active.segment,
            active.which,
            { x: point.x - active.startWorld.x, y: point.y - active.startWorld.y },
            active.rotation,
          ),
        },
        label: `reshape ${object.name}`,
        at: event.timeStamp,
      });
      return;
    }

    if (active.mode === 'vertex') {
      const g = object.geometry;
      // Every point is decided in artboard space — the dragged one follows the
      // pointer, the rest stay exactly where they were when the drag began —
      // and only then converted back to stored coordinates.
      const anchor = vertexAnchor(active.startWorld, active.index);
      const moved = anchor ? vertexAt(anchor, point, event.shiftKey) : point;
      const label = `reshape ${object.name}`;

      if (g.kind === 'path') {
        const from = active.startWorld[active.index];
        const segments = active.startSegments;
        if (!from || !segments) return;
        // A path is stated as commands, not as a list of points, so the drag is
        // handed over as a delta and the commands are rewritten around it.
        dispatch({
          type: 'setGeometry',
          id: active.id,
          geometry: {
            ...g,
            segments: movePathAnchor(
              segments,
              active.index,
              { x: moved.x - from.x, y: moved.y - from.y },
              active.rotation,
            ),
          },
          label,
          at: event.timeStamp,
        });
        return;
      }

      const world = active.startWorld.map((was, index) => (index === active.index ? moved : was));
      const stored = pointsFromWorld(world, active.rotation).map(roundPoint);
      if (g.kind === 'line') {
        // A line's two stored points, spelled as the four numbers it keeps.
        const [p1, p2] = stored;
        if (!p1 || !p2) return;
        dispatch({
          type: 'setGeometry',
          id: active.id,
          geometry: { ...g, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
          label,
          at: event.timeStamp,
        });
        return;
      }
      if (g.kind !== 'polyline' && g.kind !== 'polygon') return;
      dispatch({
        type: 'setGeometry',
        id: active.id,
        geometry: { ...g, points: stored },
        label,
        at: event.timeStamp,
      });
      return;
    }

    if (active.mode === 'resize') {
      // A circle is a centre and a radius, so its handle drag moves both: the
      // anchor holds still and the centre slides to keep it there.
      if (active.startCircle) {
        const g = object.geometry;
        if (g.kind !== 'circle') return;
        dispatch({
          type: 'setGeometry',
          id: active.id,
          geometry: {
            ...g,
            ...roundCircle(circleResize(active.startCircle, active.handle, point, active.rotation)),
          },
          label: `resize ${object.name}`,
          at: event.timeStamp,
        });
        return;
      }
      dispatch({
        type: 'resizeObject',
        id: active.id,
        box: resizeRotated(active.startBox, active.handle, point, active.rotation, event.shiftKey),
        at: event.timeStamp,
      });
      return;
    }

    const aimed = snapAngle(angleFrom(active.centre, point), event.shiftKey);
    if (active.line) {
      // A line carries no rotation: turning it moves its ends. That is what
      // keeps the far end still when the near one is later dragged — a stored
      // rotation would pivot about the midpoint, and the midpoint moves.
      dispatch({
        type: 'setGeometry',
        id: active.id,
        // The knob reads clockwise from straight up; a bearing reads from east.
        geometry: aimLine(active.line, aimed - 90),
        label: `rotate ${object.name}`,
        at: event.timeStamp,
      });
      return;
    }
    dispatch({
      type: 'rotateObject',
      id: active.id,
      degrees: aimed,
      at: event.timeStamp,
    });
  };

  /**
   * Double-clicking an outline adds a node to it, at the point of the outline
   * nearest the pointer.
   *
   * The reach is the pointer's own tolerance or half the stroke, whichever is
   * wider: a shape drawn with a thick stroke is *hit* anywhere on that stroke,
   * and a double-click that selected the shape but then added nothing would
   * read as the feature being broken rather than as the click being off.
   */
  const onDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (state.tool === 'pen') {
      // The press that opened the second click of a double-click has already
      // placed an anchor on top of the one the first click placed, so it comes
      // back out on the way through. Ending here means ending at the point that
      // was double-clicked, not at two copies of it.
      dispatch({ type: 'penBack' });
      dispatch({ type: 'penEnd', close: false });
      setPenChrome(null);
      return;
    }
    const point = pointOf(event);
    if (!point) return;
    const hit = hitTest(state.doc.objects, point);
    if (!hit || hit.locked) return;
    dispatch({
      type: 'insertVertex',
      id: hit.id,
      at: point,
      reach: Math.max(OUTLINE_REACH_PX / scale, hit.strokeWidth / 2),
    });
  };

  const onPointerUp = (event: PointerEvent) => {
    if (state.tool === 'pen') {
      // Releasing commits the anchor as it now stands, curved or not. There is
      // nothing to write: every move already wrote the handle it was pulling.
      penPress.current = null;
      setPenChrome((was) => (was ? { ...was, pulling: false } : was));
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    const active = gesture.current;
    if (!active) return;
    gesture.current = null;

    if (active.mode === 'marquee') {
      setMarquee(null);
      const point = pointOf(event);
      if (active.moved && point) {
        // Recomputed from the release rather than read off the last frame, for
        // the reason every other gesture here is absolute: the band is the two
        // points, not the moves between them.
        dispatch({
          type: 'selectInBox',
          box: pointsBox([active.startPoint, point]),
          additive: active.additive,
        });
      } else if (!active.additive) {
        // A press that never travelled is a click on the background, which is
        // how you deselect. Shift-clicking it is not: it aimed at nothing, and
        // taking the selection away would be an odd way to say so.
        dispatch({ type: 'selectObject', id: null });
      }
    } else if (active.mode === 'move' && !active.moved && active.collapse !== null) {
      // A click rather than a drag. Pressing one member of a selection and
      // letting go without moving is how you pick that one out of the group —
      // the press could not do it, because it is also how the group is lifted.
      dispatch({ type: 'selectObject', id: active.collapse });
    }

    setChrome(null);
    onDraggingChange(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    chrome,
    marquee,
    penChrome,
    surfaceProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick,
    },
    onHandleDown,
  };
}
