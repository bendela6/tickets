import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type PanelSide = 'left' | 'right';

export const PANEL_KEY_STEP = 24;

const clamp = (px: number, min: number, max: number) => Math.min(max, Math.max(min, px));

function readWidth(key: string | undefined): number | undefined {
  if (!key) return undefined;
  const stored = localStorage.getItem(key);
  if (stored === null) return undefined;
  const px = Number(stored);
  return Number.isFinite(px) && px > 0 ? px : undefined;
}

export function usePanelWidth({
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  label,
}: {
  side: PanelSide;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
  label: string;
}) {
  const panelRef = useRef<HTMLElement>(null);
  // A stored width wins over the default — that is the point of persisting it —
  // but it is clamped on read, so narrowing the bounds later cannot restore a
  // width the panel can no longer take.
  const [width, setWidthState] = useState(() =>
    clamp(readWidth(storageKey) ?? defaultWidth, minWidth, maxWidth),
  );

  const setWidth = useCallback(
    (px: number) => {
      const next = clamp(px, minWidth, maxWidth);
      setWidthState(next);
      return next;
    },
    [minWidth, maxWidth],
  );

  const persist = useCallback(
    (px: number) => {
      if (storageKey) localStorage.setItem(storageKey, String(px));
    },
    [storageKey],
  );

  // Pointer capture on the handle, so a fast drag that outruns the pointer
  // keeps resizing instead of dropping the gesture.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    let latest = width;
    const move = (e: PointerEvent) => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      // The dragged edge is the panel's inner edge, so the outer edge is the
      // fixed reference: a left panel grows rightward from its own left edge,
      // a right panel leftward from its right.
      latest = setWidth(side === 'left' ? e.clientX - rect.left : rect.right - e.clientX);
    };
    const end = (e: PointerEvent) => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      persist(latest);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // "Wider" is always away from the edge the panel is docked to.
    const widen = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const narrow = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key !== widen && event.key !== narrow) return;
    event.preventDefault();
    persist(setWidth(width + (event.key === widen ? PANEL_KEY_STEP : -PANEL_KEY_STEP)));
  };

  return {
    width,
    setWidth,
    panelRef,
    separatorProps: {
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-label': `Resize ${label}`,
      tabIndex: 0,
      onPointerDown,
      onKeyDown,
    },
  };
}
