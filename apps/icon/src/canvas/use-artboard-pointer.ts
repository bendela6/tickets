import { useCallback, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { objectId } from '../doc/defaults';
import {
  aimLine,
  bounds,
  boxCentre,
  hitTest,
  translate,
  vertexPoints,
  type Box,
  type Point,
} from '../doc/geometry';
import type { Action, EditorState } from '../doc/store';
import type { Geometry, IconObject } from '../doc/types';
import {
  angleFrom,
  circleResize,
  constrainDelta,
  isVertex,
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
  | { mode: 'move'; id: string; startGeometry: Geometry; startPoint: Point; startBox: Box }
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
   */
  | { mode: 'vertex'; id: string; index: number; rotation: number; startWorld: Point[] }
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

  const onPointerDown = (event: PointerEvent) => {
    // The middle button pans the canvas and the right one is the context menu.
    // Only the primary button draws.
    if (event.button !== 0) return;
    const point = pointOf(event);
    if (!point) return;
    const hit = hitTest(state.doc.objects, point);

    if (!hit) {
      dispatch({ type: 'selectObject', id: null });
      return;
    }

    dispatch({ type: 'selectObject', id: hit.id });
    // Locked means it will not move, not that it has left the document: it
    // still selects, so it can be unlocked from the rail.
    if (hit.locked) return;

    // Alt duplicates: the copy is what you drag away, leaving the original in
    // place. The new id is derived rather than read back from state, which
    // has not updated yet.
    let target = hit;
    if (event.altKey) {
      dispatch({ type: 'duplicateObject', id: hit.id });
      target = { ...hit, id: objectId(hit.geometry.kind, state.sequence + 1) };
    }

    const startBox = bounds(target);
    begin(event, {
      mode: 'move',
      id: target.id,
      startGeometry: target.geometry,
      startPoint: point,
      startBox,
    });
    setChrome({
      origin: startBox,
      current: startBox,
      delta: { x: 0, y: 0 },
      rotation: target.rotation,
    });
  };

  const onHandleDown = (handle: Handle, event: PointerEvent) => {
    // The overlay sits above the artboard; without this the artboard's own
    // handler would run too and start a move behind the resize.
    event.stopPropagation();
    const object = state.selectedId ? objectById(state.selectedId) : undefined;
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
      begin(event, {
        mode: 'vertex',
        id: object.id,
        index: vertexIndex(handle),
        rotation: object.rotation,
        startWorld,
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
    const active = gesture.current;
    if (!active) return;
    const point = pointOf(event);
    if (!point) return;
    const object = objectById(active.id);
    if (!object) return;

    if (active.mode === 'move') {
      const delta = constrainDelta(
        point.x - active.startPoint.x,
        point.y - active.startPoint.y,
        event.shiftKey,
      );
      const dx = Math.round(delta.x);
      const dy = Math.round(delta.y);
      dispatch({
        type: 'setGeometry',
        id: active.id,
        geometry: translate(active.startGeometry, dx, dy),
        label: `move ${object.name}`,
        at: event.timeStamp,
      });
      setChrome({
        origin: active.startBox,
        current: { ...active.startBox, x: active.startBox.x + dx, y: active.startBox.y + dy },
        delta: { x: dx, y: dy },
        rotation: object.rotation,
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
      const world = active.startWorld.map((was, index) => (index === active.index ? moved : was));
      const stored = pointsFromWorld(world, active.rotation).map(roundPoint);
      const label = `reshape ${object.name}`;
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

  const onPointerUp = (event: PointerEvent) => {
    if (!gesture.current) return;
    gesture.current = null;
    setChrome(null);
    onDraggingChange(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    chrome,
    surfaceProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    onHandleDown,
  };
}
