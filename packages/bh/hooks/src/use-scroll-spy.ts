import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

/** What `useScrollSpy` takes after the sections' ids. Every option is optional. */
export interface UseScrollSpyOptions {
  /**
   * The element the sections scroll in, as an app shell's `<main>`; the
   * window when left out. `null` while it is not known yet, as an element
   * kept in state before its ref has run: nothing is watched until it is,
   * and the first section is the one in view.
   */
  root?: Element | null;
  /**
   * How far below the top of `root` a section's top has to pass to be the
   * one in view, in pixels, 0 unless given: the height of a sticky header,
   * or a line a little way down where reading starts.
   */
  offset?: number;
}

/** What `useScrollSpy` gives back: the section in view, then the action that pins one. */
export interface UseScrollSpyResult {
  /**
   * The id of the section in view: the last whose top has passed `offset`,
   * the first before any has, and the last once a page that scrolls is
   * scrolled to its end. The pinned one while one is. `undefined` with no
   * ids.
   */
  activeId: string | undefined;
  /**
   * Makes `id` the one in view until the reader scrolls by hand, with the
   * wheel, a touch or a key: for a click on its entry, while the page
   * scrolls to it, and when a short page bottoms out before its section
   * reaches the line. The same function for the hook's life.
   */
  pin: (id: string) => void;
}

// An id holds no whitespace (HTML says so), so the list keys by its text: a
// caller that maps its entries to ids on each render subscribes once.
const SEPARATOR = ' ';

/**
 * The section in view, read from the page: where each section's top sits,
 * and how far the root has scrolled.
 */
function sectionInView(
  ids: readonly string[],
  root: Element | undefined,
  offset: number,
): string | undefined {
  const scroller = root ?? document.scrollingElement ?? document.documentElement;
  // The window's top is the viewport's, 0; an element's is where it sits in it.
  const top = root ? root.getBoundingClientRect().top : 0;
  // At the end of a page that scrolls, the last sections can never reach the
  // line, so the last one is the one in view.
  const scrolls = scroller.scrollHeight > scroller.clientHeight + 2;
  if (scrolls && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
    return ids.at(-1);
  }
  let reading = ids[0];
  for (const id of ids) {
    const section = document.getElementById(id);
    // Rounded: a section scrolled to the line sits on it, give or take a
    // fraction of a pixel.
    if (section && Math.round(section.getBoundingClientRect().top - top) <= offset) {
      reading = id;
    }
  }
  return reading;
}

/**
 * Which of a page's sections is in view, by their ids, for an "On this page"
 * list that lights it: the last section whose top has scrolled past
 * `offset`. It draws nothing and wires no element; the caller draws the
 * list, marks the entry (`aria-current`), and calls `pin` from its click.
 *
 * @param ids The sections' element ids, in the order they come on the page.
 * @param options Where the sections scroll, and where the line is.
 */
export function useScrollSpy(
  ids: readonly string[],
  { root, offset = 0 }: UseScrollSpyOptions = {},
): UseScrollSpyResult {
  const key = ids.join(SEPARATOR);
  const list = useMemo(() => (key === '' ? [] : key.split(SEPARATOR)), [key]);

  // The page is the store: its scroll and the window's size say when to read
  // it again. A null root is not known yet, so nothing is read.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (root === null) {
        return () => undefined;
      }
      const target: EventTarget = root ?? window;
      target.addEventListener('scroll', onChange, { passive: true });
      window.addEventListener('resize', onChange);
      return () => {
        target.removeEventListener('scroll', onChange);
        window.removeEventListener('resize', onChange);
      };
    },
    [root],
  );
  const read = useCallback(() => {
    return root === null ? list[0] : sectionInView(list, root, offset);
  }, [list, root, offset]);
  // The server value: the first section, as on a page not yet scrolled.
  const readOnServer = useCallback(() => list[0], [list]);
  const inView = useSyncExternalStore(subscribe, read, readOnServer);

  // The pinned id, for the ids it was pinned among: new ids drop it, so a
  // pin made on one page doesn't light a section of the same name on the next.
  const [pinned, setPinned] = useState<string | undefined>(undefined);
  const [pinnedAmong, setPinnedAmong] = useState(key);
  if (pinnedAmong !== key) {
    setPinnedAmong(key);
    setPinned(undefined);
  }
  const pin = useCallback((id: string) => setPinned(id), []);

  // Scrolling by hand lets go: the wheel or a touch on the root, or a key.
  // Scrolling from code, as to the pinned section, does not.
  const isPinned = pinned !== undefined;
  useEffect(() => {
    if (!isPinned) {
      return undefined;
    }
    const target: EventTarget = root ?? window;
    const release = () => setPinned(undefined);
    target.addEventListener('wheel', release, { passive: true });
    target.addEventListener('touchmove', release, { passive: true });
    window.addEventListener('keydown', release);
    return () => {
      target.removeEventListener('wheel', release);
      target.removeEventListener('touchmove', release);
      window.removeEventListener('keydown', release);
    };
  }, [isPinned, root]);

  const activeId = pinned !== undefined && list.includes(pinned) ? pinned : inView;
  return { activeId, pin };
}
