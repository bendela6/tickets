import { useCallback, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { objectId } from '../doc/defaults';
import { bounds, hitTest, translate, type Box, type Point } from '../doc/geometry';
import type { Action, EditorState } from '../doc/store';
import type { Geometry, IconObject } from '../doc/types';
import {
  angleFrom,
  constrainDelta,
  resizeBox,
  snapAngle,
  type Handle,
  type ResizeHandle,
} from './interaction';

type Gesture =
  | { mode: 'move'; id: string; startGeometry: Geometry; startPoint: Point; startBox: Box }
  | { mode: 'resize'; id: string; handle: ResizeHandle; startBox: Box }
  | { mode: 'rotate'; id: string; centre: Point };

export interface DragChrome {
  /** Where the object started, so the ghost can be drawn there. */
  origin: Box;
  /** Where it is now. */
  current: Box;
  /** Movement so far, in document units. */
  delta: Point;
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
    setChrome({ origin: startBox, current: startBox, delta: { x: 0, y: 0 } });
  };

  const onHandleDown = (handle: Handle, event: PointerEvent) => {
    // The overlay sits above the artboard; without this the artboard's own
    // handler would run too and start a move behind the resize.
    event.stopPropagation();
    const object = state.selectedId ? objectById(state.selectedId) : undefined;
    if (!object || object.locked) return;

    if (handle === 'rotate') {
      const box = bounds(object);
      begin(event, {
        mode: 'rotate',
        id: object.id,
        centre: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
      });
      return;
    }
    begin(event, { mode: 'resize', id: object.id, handle, startBox: bounds(object) });
  };

  const onPointerMove = (event: PointerEvent) => {
    const active = gesture.current;
    if (!active) return;
    const point = pointOf(event);
    if (!point) return;

    if (active.mode === 'move') {
      const delta = constrainDelta(
        point.x - active.startPoint.x,
        point.y - active.startPoint.y,
        event.shiftKey,
      );
      const dx = Math.round(delta.x);
      const dy = Math.round(delta.y);
      const geometry = translate(active.startGeometry, dx, dy);
      dispatch({
        type: 'setGeometry',
        id: active.id,
        geometry,
        label: `move ${objectById(active.id)?.name ?? 'object'}`,
        at: event.timeStamp,
      });
      setChrome({
        origin: active.startBox,
        current: { ...active.startBox, x: active.startBox.x + dx, y: active.startBox.y + dy },
        delta: { x: dx, y: dy },
      });
      return;
    }

    if (active.mode === 'resize') {
      const box = resizeBox(active.startBox, active.handle, point, event.shiftKey);
      dispatch({ type: 'resizeObject', id: active.id, box, at: event.timeStamp });
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
