import { useCallback, useState } from 'react';
import { usePersistedState, useResizeHandle } from '@bh/hooks';

export type PanelSide = 'left' | 'right';

export const PANEL_KEY_STEP = 24;

const clamp = (px: number, min: number, max: number) => Math.min(max, Math.max(min, px));

/** A stored width: a positive number of pixels, or unset. */
function parseWidth(raw: string): number | undefined {
  const px = Number(raw);
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
  // A stored width wins over the default — that is the point of persisting it —
  // but it is clamped on read, so narrowing the bounds later cannot restore a
  // width the panel can no longer take. Every panel under the key, on the page
  // and in the app's other tabs, has the one stored width.
  const [stored, store] = usePersistedState({
    key: storageKey,
    defaultValue: defaultWidth,
    parse: parseWidth,
  });
  // The width set but not yet stored: a drag's, until it ends.
  const [unstored, setUnstored] = useState<number | null>(null);
  const width = clamp(unstored ?? stored, minWidth, maxWidth);

  const setWidth = useCallback(
    (px: number) => {
      const next = clamp(px, minWidth, maxWidth);
      setUnstored(next);
      return next;
    },
    [minWidth, maxWidth],
  );

  // @bh/hooks' resize handle: the drag (the handle captures the pointer, so a
  // fast drag that outruns it keeps resizing), the arrow keys and the
  // separator's ARIA values. The handle is the panel's inner edge, so "wider"
  // is always away from the edge the panel is docked to: a left panel's
  // handle is its end edge, a right panel's its start.
  const { getSeparatorProps: getHandleProps, ref: panelRef } = useResizeHandle<HTMLElement>({
    orientation: 'vertical',
    edge: side === 'left' ? 'end' : 'start',
    value: width,
    onChange: setUnstored,
    // Let go, taken by the browser, or moved by a key, the width is stored.
    onCommit: (px) => {
      store(px);
      setUnstored(null);
    },
    min: minWidth,
    max: maxWidth,
    step: PANEL_KEY_STEP,
  });

  const getSeparatorProps = useCallback(
    <Own extends object>(own?: Own) => {
      return getHandleProps({ ...own, 'aria-label': `Resize ${label}` });
    },
    [getHandleProps, label],
  );

  return {
    width,
    setWidth,
    /** Goes on the panel: a drag or a key starts from the width it is laid out at. */
    panelRef,
    /**
     * The props for the separator that resizes the panel, with yours merged
     * in: its role and ARIA values (the width in pixels, which the arrows
     * change), a tab stop, the arrow keys, and the drag.
     */
    getSeparatorProps,
  };
}
