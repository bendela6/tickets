// Where a log with no scroll box of its own is scrolled: the page, or the
// box the page scrolls in (an app shell's main, say).

/**
 * The element the page scrolls in, around an element: the nearest one whose
 * content overflows it and which scrolls up and down, or none for the
 * window. Asked again each time, since a box that fits its content now may
 * scroll later.
 */
export function scrollerOf(element: HTMLElement): HTMLElement | undefined {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) {
      return undefined;
    }
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return undefined;
}

/** The top and bottom of what the reader sees, against the window: the scroller's inside, or the window's. */
export function viewOf(scroller: HTMLElement | undefined): { top: number; bottom: number } {
  if (scroller === undefined) {
    return { top: 0, bottom: window.innerHeight };
  }
  const top = scroller.getBoundingClientRect().top + scroller.clientTop;
  return { top, bottom: top + scroller.clientHeight };
}
