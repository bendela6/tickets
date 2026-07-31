import type { PointerEvent } from 'react';
import type { Box } from '../doc/geometry';
import { HANDLE_CURSOR, handlePosition, RESIZE_HANDLES, type Handle, type ResizeHandle } from './interaction';

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

const isCorner = (handle: ResizeHandle) => handle.length === 2;

function handleSize(handle: ResizeHandle): { w: number; h: number } {
  if (isCorner(handle)) return { w: CORNER_PX, h: CORNER_PX };
  return handle === 'n' || handle === 's'
    ? { w: EDGE_LONG, h: EDGE_SHORT }
    : { w: EDGE_SHORT, h: EDGE_LONG };
}

export function SelectionOverlay({
  box,
  scale,
  onHandleDown,
}: {
  /** The selected object's box, in document units. */
  box: Box;
  /** Document units to CSS pixels. */
  scale: number;
  onHandleDown: (handle: Handle, event: PointerEvent) => void;
}) {
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
            className="pointer-events-auto absolute rounded-sm border-1 border-handle bg-white p-0"
            style={{
              left: (position.x - box.x) * scale - size.w / 2,
              top: (position.y - box.y) * scale - size.h / 2,
              width: size.w,
              height: size.h,
              cursor: HANDLE_CURSOR[handle],
            }}
          />
        );
      })}

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
        className="pointer-events-auto absolute rounded-full border-1 border-handle bg-white p-0"
        style={{
          left: `calc(50% - ${ROTATE_KNOB / 2}px)`,
          top: -(ROTATE_STEM + ROTATE_KNOB),
          width: ROTATE_KNOB,
          height: ROTATE_KNOB,
          cursor: HANDLE_CURSOR.rotate,
        }}
      />
    </div>
  );
}

/** The one filled accent on the artboard layer: what the box currently measures. */
export function DimensionPill({ box, scale }: { box: Box; scale: number }) {
  return (
    <span
      className="pointer-events-none absolute flex h-5 -translate-x-1/2 items-center whitespace-nowrap rounded-sm bg-handle px-1.75 font-mono text-10 text-white"
      style={{ left: (box.x + box.w / 2) * scale, top: (box.y + box.h) * scale + 8 }}
    >
      {Math.round(box.w)} × {Math.round(box.h)}
    </span>
  );
}
