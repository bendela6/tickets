import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
} from 'react';
import { mergeProps } from './merge-props';

/** Where a drag starts: the pointer's position as it goes down, and the event. */
export interface DragStart {
  /** The pointer's distance from the window's left edge, in pixels. */
  x: number;
  /** The pointer's distance from the window's top edge, in pixels. */
  y: number;
  /** The `pointerdown` on the handle, whose default is already prevented. */
  event: ReactPointerEvent<Element>;
}

/** Where a drag has got to, from where it started. */
export interface DragMove<T> {
  /** The pointer's distance from the window's left edge now, in pixels: for a value read off a box, as a share of its width. */
  x: number;
  /** The pointer's distance from the window's top edge now, in pixels. */
  y: number;
  /** How far the pointer has moved right since it went down, in pixels (left is negative): for a value moved by the drag, as a width. */
  dx: number;
  /** How far the pointer has moved down since it went down, in pixels (up is negative). */
  dy: number;
  /** What `onStart` returned: the value the drag started from, or the box it is measured against. */
  from: T;
}

/** What `useDrag` takes. */
export interface UseDragOptions<T> {
  /**
   * Called as the pointer goes down on the handle: what it returns comes
   * with every move, as `from`, so a drag measures what it starts from once,
   * a width or a box's rect. Return `false` to let this press go by.
   */
  onStart?: (start: DragStart) => T | false;
  /** Called as the pointer moves, while a drag runs. */
  onMove?: (move: DragMove<T>) => void;
  /** Called as the pointer is let go: the drag is done, where it ended. */
  onEnd?: (move: DragMove<T>) => void;
  /** Called when the drag ends without being let go: the browser took the pointer, or `cancel` was called. */
  onCancel?: (from: T) => void;
  /** Whether no drag starts. `false` unless given; one already running goes on. */
  disabled?: boolean;
}

/** What `getHandleProps` sets on the handle, over the caller's own props. */
export interface DragHandleProps {
  onPointerDown: PointerEventHandler<Element>;
  onPointerMove: PointerEventHandler<Element>;
  onPointerUp: PointerEventHandler<Element>;
  onPointerCancel: PointerEventHandler<Element>;
  onLostPointerCapture: PointerEventHandler<Element>;
}

/** What `useDrag` gives back: state, actions, then the prop getter. */
export interface UseDragResult {
  /** Whether a drag is running: from the press to the release. */
  isDragging: boolean;
  /** Ends a running drag as if the browser had taken the pointer: `onCancel` is called. The same function for the hook's life. */
  cancel: () => void;
  /** The handle's pointer handlers, with yours merged in: both run, yours first. Give the handle `touch-action: none`, so a touch drags it rather than scrolling the page. */
  getHandleProps: <Own extends object>(
    own?: Own,
  ) => Omit<Own, keyof DragHandleProps> & DragHandleProps;
}

/** A drag running: the pointer it follows, the handle that holds it, and where it started. */
interface Running<T> {
  pointerId: number;
  handle: Element;
  x: number;
  y: number;
  from: T;
}

function release(handle: Element, pointerId: number) {
  // A browser that never captured it, or has let it go, has nothing to release.
  try {
    if (handle.hasPointerCapture(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }
  } catch {
    // jsdom has neither half of pointer capture.
  }
}

/**
 * A drag of a handle by the pointer: where it went down, where it is now,
 * and how far it has moved, for a resize handle, a divider, a scrollbar's
 * thumb or a card on a canvas. It draws nothing and moves nothing: the
 * caller turns the moves into a width, a share or a position.
 *
 * The handle captures the pointer, so a drag that outruns it keeps going;
 * only the main button starts one. The press's default is prevented, so
 * it selects no text and focuses nothing. What `onStart` returns comes with
 * each move as `from`: the value the drag started from, which a pixel value
 * adds `dx` to, or the box a share is measured against, which `x` is read
 * off.
 *
 * Its server value is no drag. A drag cut short by an unmount lets go of
 * the pointer, and calls nothing.
 */
export function useDrag<T = undefined>({
  onStart,
  onMove,
  onEnd,
  onCancel,
  disabled = false,
}: UseDragOptions<T> = {}): UseDragResult {
  const [isDragging, setIsDragging] = useState(false);
  const running = useRef<Running<T> | null>(null);

  // What the handlers read when they run, written after each commit.
  const live = useRef({ onStart, onMove, onEnd, onCancel, disabled });
  useLayoutEffect(() => {
    live.current = { onStart, onMove, onEnd, onCancel, disabled };
  });

  /** The drag running for this event's pointer, ended, or nothing. */
  const finish = useCallback((pointerId: number | undefined): Running<T> | null => {
    const drag = running.current;
    if (!drag || (pointerId !== undefined && pointerId !== drag.pointerId)) {
      return null;
    }
    running.current = null;
    release(drag.handle, drag.pointerId);
    setIsDragging(false);
    return drag;
  }, []);

  const cancel = useCallback(() => {
    const drag = finish(undefined);
    if (drag) {
      live.current.onCancel?.(drag.from);
    }
  }, [finish]);

  // The same handlers for the hook's life: what they call is read when they run.
  const handlers = useMemo((): DragHandleProps => {
    const moveOf = (drag: Running<T>, event: ReactPointerEvent<Element>): DragMove<T> => {
      return {
        x: event.clientX,
        y: event.clientY,
        dx: event.clientX - drag.x,
        dy: event.clientY - drag.y,
        from: drag.from,
      };
    };
    const lost = (event: ReactPointerEvent<Element>) => {
      const drag = finish(event.pointerId);
      if (drag) {
        live.current.onCancel?.(drag.from);
      }
    };
    return {
      onPointerDown: (event) => {
        const now = live.current;
        if (now.disabled || event.button !== 0 || running.current) {
          return;
        }
        const start: DragStart = { x: event.clientX, y: event.clientY, event };
        const from = now.onStart ? now.onStart(start) : (undefined as T);
        if (from === false) {
          return;
        }
        // No text is selected, and no native drag starts, as the pointer moves.
        event.preventDefault();
        const handle = event.currentTarget;
        try {
          handle.setPointerCapture(event.pointerId);
        } catch {
          // jsdom has neither half of pointer capture.
        }
        running.current = { pointerId: event.pointerId, handle, x: start.x, y: start.y, from };
        setIsDragging(true);
      },
      onPointerMove: (event) => {
        const drag = running.current;
        if (drag?.pointerId === event.pointerId) {
          live.current.onMove?.(moveOf(drag, event));
        }
      },
      onPointerUp: (event) => {
        const drag = finish(event.pointerId);
        if (drag) {
          live.current.onEnd?.(moveOf(drag, event));
        }
      },
      onPointerCancel: lost,
      onLostPointerCapture: lost,
    };
  }, [finish]);

  const getHandleProps = useCallback(
    <Own extends object>(own?: Own) => mergeProps(own, handlers),
    [handlers],
  );

  // A drag cut short by an unmount lets go of the pointer, and calls nothing.
  useEffect(() => {
    return () => {
      const drag = running.current;
      if (drag) {
        running.current = null;
        release(drag.handle, drag.pointerId);
      }
    };
  }, []);

  return { isDragging, cancel, getHandleProps };
}
