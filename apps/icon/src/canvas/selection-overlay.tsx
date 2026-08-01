import type { MouseEvent, PointerEvent } from 'react';
import type { Box, ControlHandlePoint, Point } from '../doc/geometry';
import {
  controlHandle,
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

/**
 * A control point is drawn smaller than a node and turned onto its corner, and
 * it is filled with the handle ink instead of being hollow. Shape and fill
 * rather than a second colour: a node is a place the shape passes through and a
 * control is not, and telling them apart must not depend on the viewer
 * comparing two hues at eight pixels across.
 */
const CONTROL_PX = 8;

const isCorner = (handle: ResizeHandle) => handle.length === 2;

function handleSize(handle: ResizeHandle): { w: number; h: number } {
  if (isCorner(handle)) return { w: CORNER_PX, h: CORNER_PX };
  return handle === 'n' || handle === 's'
    ? { w: EDGE_LONG, h: EDGE_SHORT }
    : { w: EDGE_SHORT, h: EDGE_LONG };
}

const HANDLE_SKIN = 'pointer-events-auto absolute border-1 border-handle bg-white p-0';
const CONTROL_SKIN = 'pointer-events-auto absolute border-1 border-handle bg-handle p-0';

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
 * What a two-point run's ends are called. "Start" and "end" say more than
 * "point 1" and "point 2" do, and a run with exactly two points has nothing
 * else they could be — which holds for a line, for a two-point polyline and for
 * a path of one move and one command, all of which reach here without the
 * overlay ever having to ask which kind it is drawing.
 */
function vertexLabel(index: number, count: number): string {
  if (count !== 2) return `Move point ${index + 1}`;
  return index === 0 ? 'Move start point' : 'Move end point';
}

/**
 * A node handle sits exactly on the outline, which is also where a double-click
 * asks for a new node. Without this, double-clicking a node would plant a
 * second one on top of it.
 */
const swallowDoubleClick = (event: MouseEvent) => event.stopPropagation();

/**
 * The selection for a shape made of points: one handle per point, the selected
 * node's control handles if it has any, and nothing else.
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
  selectedNode,
  controls,
  onHandleDown,
}: Omit<OverlayProps, 'box'> & {
  points: readonly Point[];
  box: Box;
  /** Which node is selected, or null. Only its controls are drawn. */
  selectedNode: number | null;
  controls: readonly ControlHandlePoint[];
}) {
  const anchor = selectedNode === null ? undefined : points[selectedNode];
  return (
    <>
      {points.map((point, index) => {
        const handle = vertexHandle(index);
        return (
          <button
            key={handle}
            type="button"
            aria-label={vertexLabel(index, points.length)}
            aria-pressed={index === selectedNode}
            onPointerDown={(event) => onHandleDown(handle, event)}
            onDoubleClick={swallowDoubleClick}
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

      {anchor && selectedNode !== null
        ? controls.map((control) => (
            <ControlHandle
              key={`${control.segment}-${control.which}`}
              control={control}
              anchor={anchor}
              node={selectedNode}
              scale={scale}
              onHandleDown={onHandleDown}
            />
          ))
        : null}

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

/**
 * One control point, tethered to the node it belongs to.
 *
 * The tether is the whole idiom: a control point on its own is a mark floating
 * beside the shape, and the line is what says which node it steers and how far
 * out it reaches. It is drawn as a bar laid along the direction between the two
 * rather than as an SVG line, because everything else on this layer is already
 * a positioned box and one element type is easier to reason about than two.
 */
function ControlHandle({
  control,
  anchor,
  node,
  scale,
  onHandleDown,
}: {
  control: ControlHandlePoint;
  anchor: Point;
  node: number;
  scale: number;
  onHandleDown: OverlayProps['onHandleDown'];
}) {
  const from = { x: anchor.x * scale, y: anchor.y * scale };
  const to = { x: control.at.x * scale, y: control.at.y * scale };
  const reach = Math.hypot(to.x - from.x, to.y - from.y);
  const bearing = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  const handle = controlHandle(control.segment, control.which);
  // `which` is the ownership rule read back: an anchor owns the second control
  // of the command arriving at it and the first of the one leaving.
  const direction = control.which === 2 ? 'incoming' : 'outgoing';

  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute bg-handle"
        style={{
          left: from.x,
          top: from.y,
          width: reach,
          height: 1,
          transformOrigin: '0 0',
          transform: `rotate(${bearing}deg)`,
        }}
      />
      <button
        type="button"
        aria-label={`Move ${direction} control of point ${node + 1}`}
        onPointerDown={(event) => onHandleDown(handle, event)}
        onDoubleClick={swallowDoubleClick}
        className={CONTROL_SKIN}
        style={{
          left: to.x - CONTROL_PX / 2,
          top: to.y - CONTROL_PX / 2,
          width: CONTROL_PX,
          height: CONTROL_PX,
          cursor: handleCursor(handle),
          transform: 'rotate(45deg)',
        }}
      />
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
