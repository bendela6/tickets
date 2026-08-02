/**
 * Making the grid a single tab stop.
 *
 * Roving `tabindex` on the CELLS is only half of it. Cells in this codebase
 * hold real widgets — a radix dropdown, row action buttons, a link — and those
 * are natively tabbable. With ten columns over a thousand rows, leaving them
 * tabbable means Tab walks the entire table before it reaches whatever is
 * after it. That is the keyboard trap the ARIA grid pattern exists to avoid,
 * so in navigation mode every widget inside a cell is pushed to `tabindex=-1`.
 *
 * The suppression is reversible, which is what makes interaction mode
 * possible: the previous value is parked in `data-table-tabindex` (empty
 * string meaning "there was no attribute") and put back exactly, rather than
 * guessed at — an `<a href>` has no tabindex to restore to, and writing `0`
 * would change its behaviour.
 *
 * These write to attributes React does not control. That holds because
 * nothing in the adapter renders a `tabIndex` prop on cell content; if
 * something starts to, React's re-render would win and this would silently
 * stop working.
 */

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';

/** Marks an element this module has suppressed, and remembers what to restore. */
const PARKED = 'data-table-tabindex';

/** The cells themselves carry the roving tabindex; they are the tab stop, not
 *  something to suppress. */
const CELL = 'data-cell-row';

function restoreOne(el: HTMLElement): void {
  const previous = el.getAttribute(PARKED);
  if (previous === null) {
    return;
  }
  if (previous === '') {
    el.removeAttribute('tabindex');
  } else {
    el.setAttribute('tabindex', previous);
  }
  el.removeAttribute(PARKED);
}

/**
 * Push every focusable widget under `root` out of the tab order, except those
 * inside `exempt` — the cell the user has entered, whose widgets have to be
 * reachable for interaction mode to mean anything.
 *
 * Idempotent: an element already parked is skipped, so running this on every
 * render costs one attribute read per widget rather than a write.
 */
export function suppressTabStops(root: HTMLElement, exempt?: HTMLElement | null): void {
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (el.hasAttribute(CELL)) {
      continue;
    }
    if (exempt && exempt.contains(el)) {
      restoreOne(el);
      continue;
    }
    if (el.hasAttribute(PARKED)) {
      continue;
    }
    el.setAttribute(PARKED, el.getAttribute('tabindex') ?? '');
    el.setAttribute('tabindex', '-1');
  }
}

/** Put every suppressed widget under `root` back exactly as it was. */
export function restoreTabStops(root: HTMLElement): void {
  for (const el of root.querySelectorAll<HTMLElement>(`[${PARKED}]`)) {
    restoreOne(el);
  }
}
