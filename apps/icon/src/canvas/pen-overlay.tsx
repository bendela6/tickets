import { handleEnds, penPreview, penSegments, type PenAnchor } from '../doc/pen';
import { pathData } from '../render/svg';
import type { Artboard } from '../doc/types';
import type { PenChrome } from './use-artboard-pointer';

/**
 * The marks the pen draws, in CSS pixels, so they stay the same size on screen
 * at every zoom — the same argument the selection handles make, for the same
 * reason: a dot that grew with the artboard would swallow the drawing at 1600%.
 */
const ANCHOR_PX = 7;
/** The first anchor is drawn larger, because it is the one you can click to close. */
const OPENING_PX = 9;
const CONTROL_PX = 6;

/**
 * The path being drawn, over the artboard.
 *
 * Drawn in the handle ink rather than in the object's own colours, and by this
 * overlay rather than by the renderer, because what is on screen is not an
 * object yet — it is a gesture in progress, and the moment it becomes an object
 * the renderer takes it over and this disappears. Painting it in its final ink
 * would promise that undo has something to take back, which it does not.
 *
 * One `<svg>` in document coordinates rather than positioned boxes: the whole
 * point is the curves, and a curve is not a box. `non-scaling-stroke` is what
 * keeps a one-pixel line one pixel wide inside a viewBox that zooms.
 */
export function PenOverlay({
  anchors,
  chrome,
  artboard,
  scale,
}: {
  anchors: readonly PenAnchor[];
  /** Where the pointer is, or null before it has been over the artboard. */
  chrome: PenChrome | null;
  artboard: Artboard;
  /** Document units to CSS pixels, so a mark can be sized in pixels. */
  scale: number;
}) {
  const drawn = penSegments(anchors, false);
  // Nothing to preview while a handle is being pulled: the pointer is steering
  // the curve into the anchor it is on, not aiming at the next one.
  const preview = chrome && !chrome.pulling ? penPreview(anchors, chrome.at) : [];
  // Only the last anchor's handle. Every anchor's would be a thicket by the
  // fifth one, and the last is the only one a drag can still be changing.
  const steering = anchors.at(-1);
  const ends = steering ? handleEnds(steering) : null;
  const radius = (px: number) => px / 2 / scale;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${artboard.width} ${artboard.height}`}
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
      fill="none"
    >
      {drawn.length > 1 ? (
        <path
          d={pathData(drawn)}
          className="stroke-handle"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {preview.length > 0 ? (
        <path
          d={pathData(preview)}
          className="stroke-handle"
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}

      {steering && ends ? (
        <>
          {/* One bar through the anchor rather than two stubs off it: the
              mirroring is the thing being shown, and two separate marks would
              read as two handles that happen to line up. */}
          <line
            x1={ends[0].x}
            y1={ends[0].y}
            x2={ends[1].x}
            y2={ends[1].y}
            className="stroke-handle"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {ends.map((end, side) => (
            <rect
              key={side}
              x={end.x - radius(CONTROL_PX)}
              y={end.y - radius(CONTROL_PX)}
              width={radius(CONTROL_PX) * 2}
              height={radius(CONTROL_PX) * 2}
              className="fill-handle"
            />
          ))}
        </>
      ) : null}

      {anchors.map((anchor, index) => (
        <circle
          key={index}
          cx={anchor.point.x}
          cy={anchor.point.y}
          r={radius(index === 0 ? OPENING_PX : ANCHOR_PX)}
          // The opening anchor is hollow: it is a target as well as a mark, and
          // the one anchor a later click is allowed to land on.
          className={index === 0 ? 'fill-white stroke-handle' : 'fill-handle'}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
