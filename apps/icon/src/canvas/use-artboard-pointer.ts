import { useCallback, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { objectId } from '../doc/defaults';
import {
  bounds,
  boxCentre,
  hitTest,
  lineEndpoints,
  translate,
  type Box,
  type Point,
} from '../doc/geometry';
import type { Action, EditorState } from '../doc/store';
import type { Geometry, IconObject } from '../doc/types';
import {
  angleFrom,
  constrainDelta,
  isEndpoint,
  lineEndpointAt,
  lineFromWorld,
  polygonResize,
  resizeRotated,
  snapAngle,
  type EndpointHandle,
  type Handle,
  type PolygonShape,
  type ResizeHandle,
} from './interaction';

const roundPolygon = (shape: PolygonShape): PolygonShape => ({
  cx: Math.round(shape.cx),
  cy: Math.round(shape.cy),
  r: Math.round(shape.r),
});

type Gesture =
  | { mode: 'move'; id: string; startGeometry: Geometry; startPoint: Point; startBox: Box }
  | {
      mode: 'resize';
      id: string;
      handle: ResizeHandle;
      startBox: Box;
      rotation: number;
      /** Set only for a polygon, which resizes as a centre and a radius. */
      startPolygon?: PolygonShape;
    }
  /**
   * `anchorWorld` is captured once, when the drag starts, and never
   * recomputed. Reading the far end's position from the document each frame
   * would read it through a pivot that the drag itself is moving.
   */
  | { mode: 'endpoint'; id: string; handle: EndpointHandle; rotation: number; anchorWorld: Point }
  | { mode: 'rotate'; id: string; centre: Point };

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
      begin(event, { mode: 'rotate', id: object.id, centre: boxCentre(bounds(object)) });
      return;
    }
    if (isEndpoint(handle)) {
      if (object.geometry.kind !== 'line') return;
      const [start, end] = lineEndpoints(object);
      begin(event, {
        mode: 'endpoint',
        id: object.id,
        handle,
        rotation: object.rotation,
        anchorWorld: handle === 'p1' ? end : start,
      });
      return;
    }
    begin(event, {
      mode: 'resize',
      id: object.id,
      handle,
      startBox: bounds(object),
      rotation: object.rotation,
      ...(object.geometry.kind === 'polygon'
        ? {
            startPolygon: {
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

    if (active.mode === 'endpoint') {
      const g = object.geometry;
      if (g.kind !== 'line') return;
      // Both ends are decided in artboard space — the dragged one follows the
      // pointer, the other stays exactly where it was when the drag began —
      // and only then converted back to stored coordinates.
      const moved = lineEndpointAt(active.anchorWorld, point, event.shiftKey);
      const [a, b] = active.handle === 'p1' ? [moved, active.anchorWorld] : [active.anchorWorld, moved];
      const next = lineFromWorld(a, b, active.rotation);
      dispatch({
        type: 'setGeometry',
        id: active.id,
        geometry: {
          ...g,
          x1: Math.round(next.x1),
          y1: Math.round(next.y1),
          x2: Math.round(next.x2),
          y2: Math.round(next.y2),
        },
        label: `reshape ${object.name}`,
        at: event.timeStamp,
      });
      return;
    }

    if (active.mode === 'resize') {
      // A polygon is a centre and a radius, so its handle drag moves both:
      // the anchor holds still and the centre slides to keep it there.
      if (active.startPolygon) {
        dispatch({
          type: 'setGeometry',
          id: active.id,
          geometry: {
            ...(object.geometry.kind === 'polygon'
              ? object.geometry
              : { kind: 'polygon' as const, sides: 6, cx: 0, cy: 0, r: 0 }),
            ...roundPolygon(
              polygonResize(active.startPolygon, active.handle, point, active.rotation),
            ),
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

    dispatch({
      type: 'rotateObject',
      id: active.id,
      degrees: snapAngle(angleFrom(active.centre, point), event.shiftKey),
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
