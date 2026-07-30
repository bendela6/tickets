// The right-hand panel's chrome: a collapse toggle and a drag-to-resize left
// edge, wrapping the (content-only) DetailPanel. Width and collapsed are
// view-only state kept here — they don't belong in the diagram reducer and
// aren't persisted across reloads. Width rides a `--sidebar-w` custom property
// (the Tailwind boundary forbids arbitrary `w-[..]` values), the same idiom the
// entity cards use for their computed widths.

import { useCallback, useRef, useState } from 'react';

import { cn, runtimeStyle } from '@tickets/ui';
import { DetailPanel } from './detail-panel';

const MIN_WIDTH = 240;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 320; // matches the old fixed w-80
const KEY_STEP = 24;

const clampWidth = (w: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));

export function SidePanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);

  // The panel is docked right, so its left edge sits at clientX and the width is
  // whatever remains to the viewport's right edge.
  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    setWidth(clampWidth(window.innerWidth - e.clientX));
  }, []);

  const stopDrag = useCallback(() => {
    dragging.current = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDrag);
  }, [onPointerMove]);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label="Expand panel"
        aria-expanded={false}
        title="Expand panel"
        className={cn(
          'flex h-full w-6 shrink-0 items-center justify-center border-l-1 border-gray-6',
          'bg-gray-2 text-gray-9 hover:bg-gray-3 hover:text-gray-12',
        )}
        onClick={() => setCollapsed(false)}
      >
        ‹
      </button>
    );
  }

  return (
    <aside
      className="relative flex w-(--sidebar-w) shrink-0 flex-col border-l-1 border-gray-6 bg-gray-2"
      style={runtimeStyle({ '--sidebar-w': `${width}px` })}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        tabIndex={0}
        className="absolute left-0 top-0 z-10 h-full w-2 cursor-col-resize bg-transparent hover:bg-blue-9"
        onPointerDown={startDrag}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setWidth((w) => clampWidth(w + KEY_STEP));
          else if (e.key === 'ArrowRight') setWidth((w) => clampWidth(w - KEY_STEP));
        }}
      />
      <div className="flex shrink-0 justify-end border-b-1 border-gray-6 px-2 py-1">
        <button
          type="button"
          aria-label="Collapse panel"
          aria-expanded
          title="Collapse panel"
          className="rounded-sm px-2 text-gray-9 hover:bg-gray-3 hover:text-gray-12"
          onClick={() => setCollapsed(true)}
        >
          ›
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <DetailPanel />
      </div>
    </aside>
  );
}
