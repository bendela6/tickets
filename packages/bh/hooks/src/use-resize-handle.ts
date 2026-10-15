import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type RefCallback } from 'react';
import { mergeProps } from './merge-props';
import { useControllableState } from './use-controllable-state';
import { useDrag, type DragHandleProps } from './use-drag';
import { useElementSize } from './use-element-size';

/**
 * Which way a separator lies, as its `aria-orientation`: `horizontal`, a bar
 * across, moved up and down, between what is stacked; `vertical`, a bar
 * down, moved left and right, between what sits side by side.
 */
export type ResizeOrientation = 'horizontal' | 'vertical';

/**
 * What a resize handle's value is: `px`, the size of the element it
 * resizes, in pixels; `share`, where it sits across the box it divides,
 * from 0 to 1.
 */
export type ResizeUnit = 'px' | 'share';

/**
 * Which edge of the element it resizes a `px` handle is on: `end`, its
 * bottom or right edge, so the element grows as the handle moves down or
 * right; `start`, its top or left edge, so it grows as the handle moves up
 * or left, as a panel docked to the right does from its left edge.
 */
export type ResizeEdge = 'start' | 'end';

/** What `useResizeHandle` takes. */
export interface UseResizeHandleOptions {
  /** Which way the separator lies, and so which arrow keys move it: up and down for `horizontal`, left and right for `vertical`. */
  orientation: ResizeOrientation;
  /** What the value is: a size in pixels, `px`, unless `share`, a share of the box from 0 to 1. */
  unit?: ResizeUnit;
  /** For `px`, which edge of the element the handle is on: `end` (bottom or right) unless `start` (top or left). */
  edge?: ResizeEdge;
  /**
   * The value, for a caller that holds it; it then changes only through
   * `onChange`. `null`, for `px`, is a caller that holds it and has set
   * none: the element's own size is the value.
   */
  value?: number | null;
  /** Where the value starts while the hook holds it. Read on the first render only. Without one, a `px` value is the element's own size until it is moved, and a share is 0.5. */
  defaultValue?: number;
  /** Hears every change, with the new value, whoever holds it: each move of a drag, each key. */
  onChange?: (value: number) => void;
  /** Hears a change once it is done: a drag let go or taken by the browser, a key, or `setValue`. Where a value is stored. */
  onCommit?: (value: number) => void;
  /** The least the value goes to: 0 unless given. */
  min?: number;
  /** The most the value goes to: no limit for `px` and 1 for a share, unless given. */
  max?: number;
  /** How far an arrow key moves it: 24 pixels, or 0.05 of the box, unless given. */
  step?: number;
}

/** What `getSeparatorProps` sets on the separator, over the caller's own props. */
export interface ResizeSeparatorProps extends DragHandleProps {
  role: 'separator';
  'aria-orientation': ResizeOrientation;
  /** The value: in pixels, or a share as a percentage; left out while there is none. */
  'aria-valuenow': number | undefined;
  'aria-valuemin': number;
  /** Left out for a `px` value with no `max`. */
  'aria-valuemax': number | undefined;
  tabIndex: 0;
  onKeyDown: (event: KeyboardEvent<Element>) => void;
}

/** What `useResizeHandle` gives back: state, the action, the prop getter, then the ref. */
export interface UseResizeHandleResult<T extends Element> {
  /**
   * The value: the caller's, the hook's, or for `px` with none set, the
   * element's own size, measured. `undefined` on a server, and until an
   * element with no size set is measured.
   */
  value: number | undefined;
  /** Whether a drag is running. */
  isDragging: boolean;
  /** Sets the value, kept within `min` and `max`, as a key would: `onChange`, then `onCommit`. The same function for the hook's life. */
  setValue: (value: number) => void;
  /**
   * The separator's props, with yours merged in: its role, orientation and
   * ARIA values, a tab stop, the arrow keys and the drag. Your handlers run
   * first, then the hook's. Name it yourself (`aria-label`), and give it
   * `touch-action: none`, so a touch drags it rather than scrolling.
   */
  getSeparatorProps: <Own extends object>(
    own?: Own,
  ) => Omit<Own, keyof ResizeSeparatorProps> & ResizeSeparatorProps;
  /**
   * Goes on the element measured: for `px` the one it resizes, whose size a
   * drag or a key starts from; for a share the box it divides, which is the
   * separator's parent element if this goes nowhere. The same function for
   * the hook's life.
   */
  ref: RefCallback<T>;
}

/** What a drag starts from: the value, and how many pixels make one of it. */
interface Grab {
  value: number;
  scale: number;
}

const KEYS: Record<ResizeOrientation, { back: string; forward: string }> = {
  horizontal: { back: 'ArrowUp', forward: 'ArrowDown' },
  vertical: { back: 'ArrowLeft', forward: 'ArrowRight' },
};

/** An element's size along the way a separator of this orientation moves it. */
function lengthOf(element: Element | null | undefined, orientation: ResizeOrientation): number {
  if (!element) {
    return 0;
  }
  const rect = element.getBoundingClientRect();
  return orientation === 'horizontal' ? rect.height : rect.width;
}

/**
 * A separator the reader drags, or moves with the arrow keys, to resize
 * what it sits beside: the height of a panel from its bottom edge, the width
 * of a sidebar, the share of a box two panes split. It holds the value, the
 * bounds and the keys, and hands out the separator's props over `useDrag`;
 * it draws nothing, and sizes nothing: the caller sets the value on the
 * element, as a height, a width or a grid's columns.
 *
 * A `px` drag or key starts from the element's own size, measured as it
 * starts, so the edge stays under the pointer even where CSS holds the
 * element smaller than its value; with nothing measured (no element, or no
 * layout), it starts from the value. A share moves by the drag's distance
 * over the box's size. Values are kept within `min` and `max`, in whole
 * pixels or to four places of a share.
 *
 * Its server value is the value given, or `undefined` for a `px` element
 * with none, which is measured before it first paints.
 */
export function useResizeHandle<T extends Element = HTMLElement>({
  orientation,
  unit = 'px',
  edge = 'end',
  value,
  defaultValue,
  onChange,
  onCommit,
  min = 0,
  max = unit === 'share' ? 1 : Number.POSITIVE_INFINITY,
  step = unit === 'share' ? 0.05 : 24,
}: UseResizeHandleOptions): UseResizeHandleResult<T> {
  const isShare = unit === 'share';
  const [held, setHeld] = useControllableState<number | null | undefined>({
    value,
    defaultValue: defaultValue ?? (isShare ? 0.5 : undefined),
    onChange: (next) => {
      if (typeof next === 'number') {
        onChange?.(next);
      }
    },
  });

  // The element measured, kept for what a drag or a key reads as it starts,
  // and its size as it changes, for the value while none is set.
  const element = useRef<T | null>(null);
  const size = useElementSize<T>({ box: 'border-box' });
  const measureRef = size.ref;
  const ref = useCallback<RefCallback<T>>(
    (node) => {
      element.current = node;
      const cleanup = node ? measureRef(node) : undefined;
      return () => {
        element.current = null;
        if (typeof cleanup === 'function') {
          cleanup();
        }
      };
    },
    [measureRef],
  );
  const measured = orientation === 'horizontal' ? size.height : size.width;
  const current = typeof held === 'number' ? held : isShare ? undefined : measured;

  // What the handlers read when they run, written after each commit.
  const live = useRef({ current, isShare, edge, orientation, min, max, step, onCommit });
  useLayoutEffect(() => {
    live.current = { current, isShare, edge, orientation, min, max, step, onCommit };
  });

  /** A value kept within the bounds, in whole pixels or to four places of a share. */
  const settle = useCallback((next: number) => {
    const now = live.current;
    const kept = Math.min(now.max, Math.max(now.min, next));
    return now.isShare ? Math.round(kept * 10_000) / 10_000 : Math.round(kept);
  }, []);

  /** Where a `px` drag or key starts: the element's size now, or the value. */
  const startOfPx = useCallback(() => {
    const now = live.current;
    const length = lengthOf(element.current, now.orientation);
    return length > 0 ? length : (now.current ?? 0);
  }, []);

  /** Sets a value and says it is done, unless it is the one already there. */
  const setValue = useCallback(
    (next: number) => {
      const now = live.current;
      const settled = settle(next);
      if (settled === now.current) {
        return;
      }
      setHeld(settled);
      now.onCommit?.(settled);
    },
    [settle, setHeld],
  );

  // The value a drag has reached, said to be done when it ends.
  const reached = useRef<number | undefined>(undefined);
  const finish = useCallback(() => {
    const value = reached.current;
    reached.current = undefined;
    if (value !== undefined) {
      live.current.onCommit?.(value);
    }
  }, []);
  const drag = useDrag<Grab>({
    onStart: ({ event }) => {
      const now = live.current;
      reached.current = undefined;
      if (!now.isShare) {
        return { value: startOfPx(), scale: 1 };
      }
      // A share is of the box: the element measured, or the separator's parent.
      const across = lengthOf(
        element.current ?? event.currentTarget.parentElement,
        now.orientation,
      );
      return across > 0 ? { value: now.current ?? 0.5, scale: across } : false;
    },
    onMove: ({ dx, dy, from }) => {
      const now = live.current;
      const moved = now.orientation === 'horizontal' ? dy : dx;
      const toward = now.isShare || now.edge === 'end' ? 1 : -1;
      const next = settle(from.value + (toward * moved) / from.scale);
      reached.current = next;
      setHeld(next);
    },
    // Let go, or taken by the browser, it keeps the value it shows.
    onEnd: finish,
    onCancel: finish,
  });

  const onKeyDown = useCallback(
    (event: KeyboardEvent<Element>) => {
      const now = live.current;
      const keys = KEYS[now.orientation];
      const way = event.key === keys.forward ? 1 : event.key === keys.back ? -1 : 0;
      if (way === 0) {
        return;
      }
      event.preventDefault();
      // An arrow moves the separator its way; a `px` handle on the start
      // edge grows what it resizes as it moves back.
      const toward = now.isShare || now.edge === 'end' ? 1 : -1;
      const from = now.isShare ? (now.current ?? 0.5) : startOfPx();
      setValue(from + way * toward * now.step);
    },
    [setValue, startOfPx],
  );

  const valueNow =
    current === undefined ? undefined : isShare ? Math.round(current * 100) : Math.round(current);
  const valueMin = isShare ? Math.round(min * 100) : min;
  const valueMax = Number.isFinite(max) ? (isShare ? Math.round(max * 100) : max) : undefined;
  const { getHandleProps } = drag;
  const getSeparatorProps = useCallback(
    <Own extends object>(own?: Own) => {
      const separator = mergeProps(own, {
        role: 'separator' as const,
        'aria-orientation': orientation,
        'aria-valuenow': valueNow,
        'aria-valuemin': valueMin,
        'aria-valuemax': valueMax,
        tabIndex: 0 as const,
        onKeyDown,
      });
      return getHandleProps(separator) as Omit<Own, keyof ResizeSeparatorProps> &
        ResizeSeparatorProps;
    },
    [getHandleProps, orientation, valueNow, valueMin, valueMax, onKeyDown],
  );

  return { value: current, isDragging: drag.isDragging, setValue, getSeparatorProps, ref };
}
