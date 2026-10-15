import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { scrollerOf, viewOf } from './utils/scroller';

/** What `useFollowEnd` gives back. */
export interface FollowEnd {
  /** How many lines arrived below while the reader was scrolled up from the end. */
  unseen: number;
  /** Scrolls to the end and follows it again. */
  jump: () => void;
}

/** What `useFollowEnd` reads of the log. */
export interface FollowEndOptions {
  /** How many lines the log has. */
  count: number;
  /** What keeps the last line's place: its id, or its index. */
  lastKey: string | number | undefined;
  /** Where a line is now, by what keeps its place: -1 if it is gone. */
  indexOf: (key: string | number) => number;
}

/**
 * Where the log's end is, against what the reader sees of the page: in
 * view; below it, the reader in the log above its end; or out of view, the
 * whole log below what they see or the reader past it, reading on below.
 */
type EndAt = 'in-view' | 'below' | 'away';

// How far below the visible area the end may sit and still count as at the
// end: a reader a few pixels short of it is still following.
const SLACK = 24;

function endOf(element: HTMLElement): EndAt {
  const { top, bottom } = element.getBoundingClientRect();
  const view = viewOf(scrollerOf(element));
  if (bottom < view.top || top >= view.bottom) {
    return 'away';
  }
  return bottom > view.bottom + SLACK ? 'below' : 'in-view';
}

/** Scrolls the page, or the box it scrolls in, just far enough to show the log's end. */
function showEnd(element: HTMLElement) {
  const scroller = scrollerOf(element);
  const by = element.getBoundingClientRect().bottom - viewOf(scroller).bottom;
  if (by <= 0) {
    return;
  }
  if (scroller === undefined) {
    window.scrollBy({ top: by, behavior: 'instant' });
  } else {
    scroller.scrollBy({ top: by, behavior: 'instant' });
  }
}

/**
 * Follows the log's end while lines arrive: a log with no scroll box of its
 * own grows with the page, so it is the page, or the box the page scrolls
 * in, that is kept at the log's end. It follows while the end is in view;
 * once the reader scrolls up from it, it stops and counts the lines that
 * arrive, until they jump back or scroll down to it.
 *
 * Only arriving lines move the page: a fold opened or closed, or a time
 * ticking, never does.
 */
export function useFollowEnd(
  ref: RefObject<HTMLElement | null>,
  { count, lastKey, indexOf }: FollowEndOptions,
): FollowEnd {
  const following = useRef(true);
  const [unseen, setUnseen] = useState(0);
  const last = useRef({ count, lastKey });

  // Each scroll says again whether the reader is at the end. Scroll events
  // do not bubble, so one listener on the document, capturing, hears the
  // page's and every box's.
  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return undefined;
    }
    following.current = endOf(element) === 'in-view';
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && target !== document && !target.contains(element)) {
        return;
      }
      const at = endOf(element);
      following.current = at === 'in-view';
      if (at !== 'below') {
        setUnseen(0);
      }
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [ref]);

  // After each render, before the browser paints: lines that arrived are
  // followed or counted; anything else, a fold say, only says again whether
  // the end is in view.
  useLayoutEffect(() => {
    const element = ref.current;
    const before = last.current;
    last.current = { count, lastKey };
    if (element === null) {
      return;
    }
    const arrived = arrivedSince(before, { count, lastKey }, indexOf);
    if (arrived === 0) {
      following.current = endOf(element) === 'in-view';
    } else if (following.current) {
      showEnd(element);
    } else if (endOf(element) === 'below') {
      setUnseen((was) => was + arrived);
    }
  });

  const jump = useCallback(() => {
    const element = ref.current;
    if (element !== null) {
      showEnd(element);
    }
    following.current = true;
    setUnseen(0);
  }, [ref]);

  return { unseen, jump };
}

/**
 * How many lines arrived at the end: those after the line that was last, if
 * it is still there (a tail whose start moves on keeps its count), else the
 * growth in the count, and at least one when the last line changed.
 */
function arrivedSince(
  before: { count: number; lastKey: string | number | undefined },
  now: { count: number; lastKey: string | number | undefined },
  indexOf: (key: string | number) => number,
): number {
  if (now.lastKey === before.lastKey && now.count === before.count) {
    return 0;
  }
  const was = before.lastKey === undefined ? -1 : indexOf(before.lastKey);
  if (was >= 0 && was < now.count) {
    return now.count - 1 - was;
  }
  return Math.max(now.count - before.count, now.lastKey === before.lastKey ? 0 : 1);
}
