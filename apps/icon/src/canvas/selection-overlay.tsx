import type { PointerEvent } from 'react';
import type { Box, Point } from '../doc/geometry';
import {
  handleCursor,
  handlePosition,
  RESIZE_HANDLES,
  vertexHandle,
  type Handle,
  type ResizeHandle,
} from './interaction';

/**
 * Everything on the artboard layer is fixed `handle` in both themes, because
 * it belongs to the drawing rather than to the chrome.
 *
 * Corners are square and edges are oblong, so the two are never confused at
 * 100%; the rotation knob is a circle on a stem, detached from the box so it
 * can never be mistaken for a resize. These are pixel sizes rather than tokens
 * on purpose — a handle must stay the same size on screen at every zoom, which
 * is exactly what a scalable spacing token is designed not to do.
 */
const CORNER_PX = 8;
const EDGE_LONG = 8;
const EDGE_SHORT = 7;
const ROTATE_STEM = 14;
const ROTATE_KNOB = 10;
const ENDPOINT_PX = 10;

const isCorner = (handle: ResizeHandle) => handle.length === 2;

function handleSize(handle: ResizeHandle): { w: number; h: number } {
  if (isCorner(handle)) return { w: CORNER_PX, h: CORNER_PX };
  return handle === 'n' || handle === 's'
    ? { w: EDGE_LONG, h: EDGE_SHORT }
    : { w: EDGE_SHORT, h: EDGE_LONG };
}

const HANDLE_SKIN = 'pointer-events-auto absolute border-1 border-handle bg-white p-0';

export interface OverlayProps {
  /** The object's box, in document units, BEFORE rotation. */
  box: Box;
  /** Degrees. The overlay turns with the object so handles stay on its own axes. */
  rotation: number;
  /** Document units to CSS pixels. */
  scale: number;
  onHandleDown: (handle: Handle, event: PointerEvent) => void;
}

/**
 * The box, its eight resize handles and the rotation knob.
 *
 * The whole overlay is rotated with the object rather than drawn around its
 * axis-aligned extent. A rotated shape sitting inside an upright rectangle
 * tells you nothing about which handle grows which side, and the box stops
 * touching the artwork at all.
 */
export function SelectionOverlay({ box, rotation, scale, onHandleDown }: OverlayProps) {
  return (
    <div
      // Not interactive itself — only the handles inside it are — so the
      // object underneath stays clickable through the middle of the box.
      className="pointer-events-none absolute outline-1 outline-handle"
      style={{
        left: box.x * scale,
        top: box.y * scale,
        width: box.w * scale,
        height: box.h * scale,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {RESIZE_HANDLES.map((handle) => {
        const position = handlePosition(box, handle);
        const size = handleSize(handle);
        return (
          <button
            key={handle}
            type="button"
            aria-label={`Resize ${handle}`}
            onPointerDown={(event) => onHandleDown(handle, event)}
            className={`${HANDLE_SKIN} rounded-sm`}
            style={{
              left: (position.x - box.x) * scale - size.w / 2,
              top: (position.y - box.y) * scale - size.h / 2,
              width: size.w,
              height: size.h,
              cursor: handleCursor(handle),
            }}
          />
        );
      })}

      <RotateKnob onHandleDown={onHandleDown} />
    </div>
  );
}

/**
 * What a two-point run's ends are called. "Start" and "end" say more about a
 * line than "point 1" and "point 2" do, and a line is the only shape whose
 * points have names of their own.
 */
function vertexLabel(index: number, count: number): string {
  if (count !== 2) return `Move point ${index + 1}`;
  return index === 0 ? 'Move start point' : 'Move end point';
}

/**
 * The selection for a shape made of points: one handle per point, and nothing
 * else.
 *
 * Drawn in artboard space rather than inside a rotated box, because the points
 * already carry the shape — there is no box for them to sit in the corners of,
 * and dragging one must move only itself.
 */
export function PointsSelectionOverlay({
  points,
  box,
  rotation,
  scale,
  onHandleDown,
}: Omit<OverlayProps, 'box'> & { points: readonly Point[]; box: Box }) {
  return (
    <>
      {points.map((point, index) => {
        const handle = vertexHandle(index);
        return (
          <button
            key={handle}
            type="button"
            aria-label={vertexLabel(index, points.length)}
            onPointerDown={(event) => onHandleDown(handle, event)}
            className={`${HANDLE_SKIN} rounded-full`}
            style={{
              left: point.x * scale - ENDPOINT_PX / 2,
              top: point.y * scale - ENDPOINT_PX / 2,
              width: ENDPOINT_PX,
              height: ENDPOINT_PX,
              cursor: handleCursor(handle),
            }}
          />
        );
      })}

      <div
        className="pointer-events-none absolute"
        style={{
          left: box.x * scale,
          top: box.y * scale,
          width: box.w * scale,
          height: box.h * scale,
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <RotateKnob onHandleDown={onHandleDown} />
      </div>
    </>
  );
}

function RotateKnob({ onHandleDown }: Pick<OverlayProps, 'onHandleDown'>) {
  return (
    <>
      <span
        aria-hidden
        className="absolute bg-handle"
        style={{
          left: '50%',
          top: -(ROTATE_STEM + ROTATE_KNOB / 2),
          width: 1,
          height: ROTATE_STEM,
        }}
      />
      <button
        type="button"
        aria-label="Rotate"
        onPointerDown={(event) => onHandleDown('rotate', event)}
        className={`${HANDLE_SKIN} rounded-full`}
        style={{
          left: `calc(50% - ${ROTATE_KNOB / 2}px)`,
          top: -(ROTATE_STEM + ROTATE_KNOB),
          width: ROTATE_KNOB,
          height: ROTATE_KNOB,
          cursor: handleCursor('rotate'),
        }}
      />
    </>
  );
}
