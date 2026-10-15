import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useDrag } from '@bh/hooks';
import { Button } from '@bh/ui';
import { BlockBar, BlockFrame, BlockTitle, Kicker } from '../parts';
import { extentOf, placeTables, relationsOf } from './layout';
import type { ErdLayout, ErdModel, Point } from './schema';
import { TableCard, type CardHandle } from './table-card';
import { Wires } from './wires';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
/** The canvas grows with the diagram between these, and scrolls past the second. */
const CANVAS_MIN = 240;
const CANVAS_MAX = 560;
/** The ground's dot pitch, which scales with the diagram. */
const DOT = 24;
/** What an arrow key moves a card by; with Shift, further. */
const NUDGE = 8;
const NUDGE_FAR = 40;
const ARROWS = new Map<string, Point>([
  ['ArrowLeft', [-1, 0]],
  ['ArrowRight', [1, 0]],
  ['ArrowUp', [0, -1]],
  ['ArrowDown', [0, 1]],
]);

const NO_LAYOUT: ErdLayout = {};

const clampZoom = (zoom: number): number => {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(zoom.toFixed(2))));
};

/** No card goes past the canvas's top or left edge, where scrolling cannot reach it. */
const onCanvas = ([x, y]: Point): Point => [Math.max(0, x), Math.max(0, y)];

const same = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1];

/** A card taken up by the pointer: its name, and where it was. */
interface Grab {
  name: string;
  from: Point;
}

export interface ErdProps {
  model: ErdModel;
  /** Where the host kept each table; a table it has no entry for is laid out. */
  layout?: ErdLayout;
  /** Told every table's position after the reader moves one, and `{}` on a reset. */
  onLayoutChange?: (layout: ErdLayout) => void;
}

/**
 * An entity relationship diagram: a card per table on a dotted canvas, each
 * placed right of what it references, with a wire per reference. The reader
 * drags a card by its name strip, or moves it with the arrow keys, and zooms
 * from the bar; the reset puts everything back.
 */
export function Erd({ model, layout = NO_LAYOUT, onLayoutChange }: ErdProps) {
  const [moved, setMoved] = useState<ErdLayout>({});
  // The card being dragged, which lifts, and whose wires are drawn active.
  const [held, setHeld] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const id = useId();
  const hint = `${id}-hint`;
  const ground = `${id}-ground`;

  // The reader's own moves win, then the host's kept layout, then the auto
  // layout. Resolved every render, so a table added since always has a place.
  const placed = placeTables(model.tables, moved, layout);
  const relations = relationsOf(model.tables);
  const { width, height } = extentOf(placed);
  const count = placed.length;

  const move = (name: string, at: Point) => {
    setMoved((before) => ({ ...before, [name]: at }));
  };
  const keep = (name: string, at: Point) => {
    const all: ErdLayout = Object.fromEntries(placed.map((table) => [table.name, table.at]));
    onLayoutChange?.({ ...all, [name]: at });
  };
  const reset = () => {
    setZoom(1);
    setMoved({});
    onLayoutChange?.({});
  };

  // The pointer moves in screen pixels and a card in the unscaled scene, so
  // the distance is divided by the zoom. Measured from where the drag began
  // rather than summed per event, so no rounding builds up.
  const dragged = (grab: Grab, dx: number, dy: number): Point => {
    return onCanvas([grab.from[0] + dx / zoom, grab.from[1] + dy / zoom]);
  };

  // One drag for every card: a card's own press says which it is, just
  // before the drag starts from it. The handle captures the pointer, so the
  // card follows a pointer that outruns it off the canvas.
  const grabbed = useRef<Grab | null>(null);
  const drag = useDrag<Grab>({
    onStart: () => {
      const grab = grabbed.current;
      if (!grab) {
        return false;
      }
      setHeld(grab.name);
      return grab;
    },
    onMove: ({ dx, dy, from }) => move(from.name, dragged(from, dx, dy)),
    onEnd: ({ dx, dy, from }) => {
      setHeld(null);
      const to = dragged(from, dx, dy);
      if (!same(to, from.from)) {
        move(from.name, to);
        keep(from.name, to);
      }
    },
    onCancel: (from) => {
      setHeld(null);
      const at = placed.find((table) => table.name === from.name)?.at;
      if (at && !same(at, from.from)) {
        keep(from.name, at);
      }
    },
  });

  const handleOf = (name: string, at: Point): CardHandle => {
    return drag.getHandleProps({
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        grabbed.current = { name, from: at };
        // The drag prevents the press's default, focus with it: the card
        // takes focus itself, so the arrow keys move it after a click.
        event.currentTarget.focus({ preventScroll: true });
      },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        const arrow = ARROWS.get(event.key);
        if (!arrow) {
          return;
        }
        event.preventDefault();
        const step = event.shiftKey ? NUDGE_FAR : NUDGE;
        const to = onCanvas([at[0] + arrow[0] * step, at[1] + arrow[1] * step]);
        move(name, to);
        keep(name, to);
      },
    });
  };

  return (
    <BlockFrame>
      <BlockBar className="pr-6">
        {model.title ? <BlockTitle>{model.title}</BlockTitle> : null}
        <Kicker as="span" className="min-w-0 truncate">
          {count} {count === 1 ? 'table' : 'tables'} · drag to arrange
        </Kicker>
        <span className="flex-1" />
        <span
          aria-live="polite"
          className="text-11 text-gray-10 min-w-32 text-right font-mono tabular-nums"
        >
          {zoom.toFixed(1)}×
        </span>
        <span className="flex items-center gap-2">
          <Button
            variant="ghost"
            tone="neutral"
            size="xs"
            icon="minus"
            label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((before) => clampZoom(before - ZOOM_STEP))}
          />
          <Button
            variant="ghost"
            tone="neutral"
            size="xs"
            icon="refresh"
            label="Reset zoom and layout"
            onClick={reset}
          />
          <Button
            variant="ghost"
            tone="neutral"
            size="xs"
            icon="plus"
            label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((before) => clampZoom(before + ZOOM_STEP))}
          />
        </span>
      </BlockBar>
      <p id={hint} className="sr-only">
        Drag a table by its name to move it, or focus its name and use the arrow keys. Hold Shift to
        move further.
      </p>
      <div
        data-testid="erd-canvas"
        data-zoom={zoom}
        data-dragging={held === null ? undefined : 'true'}
        role="group"
        aria-label={model.title ? `${model.title} diagram` : 'Entity relationship diagram'}
        className="bg-gray-2 relative overflow-auto data-[dragging=true]:select-none"
        style={{ height: Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, height * zoom)) }}
      >
        {/* Sized to the scaled diagram, and at least the canvas, so the ground
            covers whatever the reader can scroll to. */}
        <div
          className="relative min-h-full min-w-full"
          style={{ width: width * zoom, height: height * zoom }}
        >
          <svg aria-hidden className="absolute inset-0 size-full">
            <defs>
              {/* The dotted ground, as markup rather than a background-image value. */}
              <pattern
                id={ground}
                width={DOT}
                height={DOT}
                patternUnits="userSpaceOnUse"
                patternTransform={`scale(${zoom})`}
              >
                <circle cx={1} cy={1} r={1} className="fill-gray-7" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${ground})`} />
          </svg>
          {/* transform, width and height are runtime values Tailwind cannot see */}
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width, height, transform: `scale(${zoom})` }}
          >
            <Wires
              id={id}
              relations={relations}
              placed={placed}
              active={held ?? undefined}
              width={width}
              height={height}
            />
            {placed.map(({ name, table, at }) => {
              return (
                <TableCard
                  key={name}
                  name={name}
                  table={table}
                  at={at}
                  dragging={held === name}
                  hint={hint}
                  handle={handleOf(name, at)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </BlockFrame>
  );
}
