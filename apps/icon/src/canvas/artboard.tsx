import { useRef } from 'react';
import { cn } from '@tickets/ui';
import { ARTBOARD_PX, GRID_UNITS, SAFE_ZONE } from '../doc/constants';
import { bounds, lineEndpoints } from '../doc/geometry';
import { selectedObject } from '../doc/store';
import { safeZoneWarnings } from '../doc/validate';
import type { IconObject } from '../doc/types';
import { useEditor } from '../editor-context';
import { gridInk } from '../render/ink';
import { renderPosed } from '../render/svg';
import { chromeIsDim, posedFor } from '../view';
import { EmptyArtboard } from './empty-artboard';
import { DimensionPill, LineSelectionOverlay, SelectionOverlay } from './selection-overlay';
import { useArtboardPointer } from './use-artboard-pointer';

/**
 * The artboard: the one bright, high-contrast surface on screen, and the only
 * thing that is the subject rather than apparatus.
 *
 * The artwork is painted by the *same* renderer the export uses, so what is on
 * screen and what lands in a PNG cannot diverge. That also means the shapes
 * carry no DOM identity — selection and dragging go through hit-testing in
 * document space rather than through per-shape event handlers, which is what
 * a rotated polygon needs anyway.
 */
export function Artboard() {
  const { state, dispatch, view, setView } = useEditor();
  const surfaceRef = useRef<HTMLDivElement>(null);

  const side = (ARTBOARD_PX * view.zoom) / 100;
  const scale = side / state.doc.size;
  const posed = posedFor(state.doc, view);
  const dim = chromeIsDim(view);

  const { chrome, surfaceProps, onHandleDown } = useArtboardPointer({
    state,
    dispatch,
    scale,
    surfaceRef,
    onDraggingChange: (dragging) => setView((v) => ({ ...v, dragging })),
  });

  const selected = selectedObject(state);
  const warnings = safeZoneWarnings(state.doc);
  const selectedWarns = selected ? warnings.some((w) => w.id === selected.id) : false;
  const showSafeZone = selectedWarns || view.safeZoneOpen;

  // Handles are withdrawn while dragging or playing — you cannot resize while
  // moving, and the transport is the only lit thing during playback.
  const showHandles = selected !== null && !selected.hidden && !dim;
  const selectionBox = selected && !selected.hidden ? bounds(selected) : null;

  return (
    <div
      ref={surfaceRef}
      role="img"
      aria-label={`${state.doc.name} artboard, ${state.doc.objects.length} objects`}
      className="relative flex-none touch-none outline-1 outline-gray-7 shadow-artboard"
      style={{ width: side, height: side, background: state.doc.background[view.ground] }}
      {...surfaceProps}
    >
      <div
        aria-hidden
        dangerouslySetInnerHTML={{
          __html: renderPosed(state.doc, posed, { ground: view.ground, background: false }),
        }}
        className="absolute inset-0 [&>svg]:size-full"
      />

      {view.grid ? (
        <div
          aria-hidden
          className={cn('pointer-events-none absolute inset-0', dim && 'opacity-50')}
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: `${GRID_UNITS * scale}px ${GRID_UNITS * scale}px`,
            color: gridInk(state.doc.background[view.ground]),
          }}
        />
      ) : null}

      {showSafeZone ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full border-1 border-dashed border-safe-zone"
            style={{
              left: `${((1 - SAFE_ZONE) / 2) * 100}%`,
              top: `${((1 - SAFE_ZONE) / 2) * 100}%`,
              width: `${SAFE_ZONE * 100}%`,
              height: `${SAFE_ZONE * 100}%`,
            }}
          />
          <span className="pointer-events-none absolute bottom-2 left-2 flex h-4 items-center whitespace-nowrap rounded-sm bg-safe-zone px-1.5 font-mono text-9 text-white">
            {Math.round(SAFE_ZONE * 100)}% maskable safe zone
          </span>
        </>
      ) : null}

      {chrome ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute border-1 border-dashed border-handle/45"
            style={{
              left: chrome.origin.x * scale,
              top: chrome.origin.y * scale,
              width: chrome.origin.w * scale,
              height: chrome.origin.h * scale,
              transform: `rotate(${chrome.rotation}deg)`,
            }}
          />
          <Guides box={chrome.current} scale={scale} />
          <span
            className="pointer-events-none absolute flex h-5 items-center gap-2 whitespace-nowrap rounded-sm bg-gray-12 px-2 font-mono text-10 text-gray-1"
            style={{
              left: (chrome.current.x + chrome.current.w) * scale - 6,
              top: (chrome.current.y + chrome.current.h) * scale + 10,
            }}
          >
            {Math.round(chrome.current.x)}, {Math.round(chrome.current.y)}
            <span>
              Δ {chrome.delta.x >= 0 ? '+' : '−'}
              {Math.abs(chrome.delta.x)} {chrome.delta.y >= 0 ? '+' : '−'}
              {Math.abs(chrome.delta.y)}
            </span>
          </span>
        </>
      ) : null}

      {selectionBox && selected && !showHandles && chrome ? (
        <div
          aria-hidden
          className="pointer-events-none absolute outline-1 outline-handle"
          style={{
            left: selectionBox.x * scale,
            top: selectionBox.y * scale,
            width: selectionBox.w * scale,
            height: selectionBox.h * scale,
            transform: `rotate(${selected.rotation}deg)`,
          }}
        />
      ) : null}

      {showHandles && selectionBox && selected ? (
        <>
          {selected.geometry.kind === 'line' ? (
            <LineSelectionOverlay
              endpoints={lineEndpoints(selected)}
              box={selectionBox}
              rotation={selected.rotation}
              scale={scale}
              onHandleDown={onHandleDown}
            />
          ) : (
            <SelectionOverlay
              box={selectionBox}
              rotation={selected.rotation}
              scale={scale}
              onHandleDown={onHandleDown}
            />
          )}
          <DimensionPill
            box={selectionBox}
            rotation={selected.rotation}
            scale={scale}
            label={dimensionLabel(selected)}
          />
        </>
      ) : null}

      {state.doc.objects.length === 0 ? <EmptyArtboard /> : null}
    </div>
  );
}

/**
 * What the pill reports, in each shape's own terms.
 *
 * A line's box is a by-product of where its ends happen to be, so quoting
 * `260 × 20` for one is describing the wrong thing — its length is the
 * measurement that means something, and its thickness is a property with its
 * own field. A polygon is radial, so it reads as a radius.
 */
function dimensionLabel(object: IconObject): string {
  const g = object.geometry;
  if (g.kind === 'line') {
    return `${Math.round(Math.hypot(g.x2 - g.x1, g.y2 - g.y1))} long`;
  }
  if (g.kind === 'polygon') return `r ${Math.round(g.r)} · ${g.sides} sides`;
  const box = bounds(object);
  return `${Math.round(box.w)} × ${Math.round(box.h)}`;
}

/**
 * The two centre guides shown mid-drag. Each states something true — one names
 * the object's own centres, the other the artboard's — rather than being
 * decoration that appears because something is moving.
 */
function Guides({ box, scale }: { box: { x: number; y: number; w: number; h: number }; scale: number }) {
  const cx = (box.x + box.w / 2) * scale;
  const cy = (box.y + box.h / 2) * scale;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute"
        style={{
          left: cx,
          top: 0,
          bottom: 0,
          width: 1,
          backgroundImage:
            'repeating-linear-gradient(to bottom, var(--color-handle) 0 4px, transparent 4px 8px)',
        }}
      />
      <div
        className="absolute"
        style={{
          top: cy,
          left: 0,
          right: 0,
          height: 1,
          backgroundImage:
            'repeating-linear-gradient(to right, var(--color-handle) 0 4px, transparent 4px 8px)',
        }}
      />
      <span
        className="absolute flex h-4 items-center whitespace-nowrap rounded-sm bg-white px-1.25 font-mono text-9 tracking-wide text-handle inset-ring-1 inset-ring-handle/30"
        style={{ left: cx + 5, top: 9 }}
      >
        centres
      </span>
      <span
        className="absolute flex h-4 items-center whitespace-nowrap rounded-sm bg-white px-1.25 font-mono text-9 tracking-wide text-handle inset-ring-1 inset-ring-handle/30"
        style={{ top: cy + 5, left: 9 }}
      >
        artboard centre
      </span>
    </div>
  );
}
