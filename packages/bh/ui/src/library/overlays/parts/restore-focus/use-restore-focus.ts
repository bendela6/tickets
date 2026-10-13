import { useCallback, useLayoutEffect, useRef, type FocusEvent } from 'react';

export interface RestoreFocusOptions {
  /**
   * Whether the surface is open, for a surface Radix does not run. The hook
   * then remembers what has focus as it turns true, and gives focus back as
   * it turns false or the surface unmounts open. Leave it out for a Radix
   * surface, and hand its Content the handlers the hook returns.
   */
  open?: boolean;
  /**
   * Whether a surface that mounts already open was opened by what had focus
   * then: true for one a click renders, like a drawer a row mounts; false
   * for a panel the page lays out open, which nothing opened. Only with
   * `open`.
   */
  rememberOnMount?: boolean;
  /**
   * Where focus goes when the opener has left the page or can no longer take
   * it: the surface's own way back, like the button that reopens it. Asked
   * as the surface closes, so it can be an element the close rendered.
   */
  fallback?: () => HTMLElement | null | undefined;
}

/** What `useRestoreFocus` returns: the two handlers a Radix surface hands its Content. */
export interface RestoreFocus {
  /** The Content's `onFocus`: the first time focus enters, remembers where it came from. */
  onFocus: (event: FocusEvent) => void;
  /** The Content's `onCloseAutoFocus`: once the content has left the page, gives focus back. */
  onCloseAutoFocus: (event: Event) => void;
}

interface Opener {
  element: HTMLElement;
  // Its ancestors as the surface opened, nearest first. A detached element
  // keeps only the ancestors that left with it, so the ones that stayed are
  // kept here, to find where it was.
  ancestors: HTMLElement[];
}

function remember(element: EventTarget | null): Opener | null {
  if (!(element instanceof HTMLElement) || element === document.body) {
    return null;
  }
  const ancestors: HTMLElement[] = [];
  for (
    let node = element.parentElement;
    node && node !== document.body;
    node = node.parentElement
  ) {
    ancestors.push(node);
  }
  return { element, ancestors };
}

function isNothing(element: Element | null): boolean {
  return element === null || element === document.body || element === document.documentElement;
}

// Where the browser leaves focus when the element that had it leaves the
// page. Focus anywhere else was put there by the reader or the app, and stays.
function nothingHasFocus(): boolean {
  return isNothing(document.activeElement);
}

// Tries rather than predicts: the browser refuses focus to an element that is
// disabled, hidden, inert or off the page, so asking it covers every way the
// opener can have stopped taking focus.
function takesFocus(element: HTMLElement | null | undefined, options?: FocusOptions): boolean {
  if (!element?.isConnected) {
    return false;
  }
  element.focus(options);
  return document.activeElement === element;
}

function focusOpener(
  opener: Opener | null,
  fallback: (() => HTMLElement | null | undefined) | undefined,
) {
  return takesFocus(opener?.element) || takesFocus(fallback?.());
}

// The last resort: the nearest ancestor of the opener still on the page that
// takes focus, such as the drawer a dialog was opened from. Without it, focus
// would sit on <body> behind that drawer. Without scrolling, as a container
// is often taller than the window.
function focusNearOpener(opener: Opener | null) {
  return opener?.ancestors.some((ancestor) => takesFocus(ancestor, { preventScroll: true }));
}

function giveFocusBack(
  opener: Opener | null,
  fallback: (() => HTMLElement | null | undefined) | undefined,
) {
  if (nothingHasFocus() && !focusOpener(opener, fallback)) {
    focusNearOpener(opener);
  }
}

/**
 * Gives focus back to what had it when a surface opened, once the surface
 * closes: to the opener if it is still on the page and takes focus, else to
 * `fallback`, else to the nearest thing still on the page that held the
 * opener. It does nothing when something already has focus by then.
 *
 * Without `open`, Radix runs the surface: hand `onFocus` and
 * `onCloseAutoFocus` to its Content. With `open`, the hook runs it by
 * itself. Dialog and Drawer are the first kind, SidePanel the second.
 */
export function useRestoreFocus({
  open,
  rememberOnMount = true,
  fallback,
}: RestoreFocusOptions = {}): RestoreFocus {
  const opener = useRef<Opener | null>(null);
  const entered = useRef(false);
  // Whether the surface was open at the last commit; undefined before the first.
  const wasOpen = useRef<boolean | undefined>(undefined);
  // Asked at close, not at open, and the caller may pass a new one each render.
  const fallbackRef = useRef(fallback);
  useLayoutEffect(() => {
    fallbackRef.current = fallback;
  });

  // What had focus as the render that opens or closes the surface ran, before
  // React changed the page. By this component's effects, a field inside it
  // with `autoFocus` has taken focus, or the close has dropped it.
  const focusedAsItChanged = useRef<Element | null>(null);
  if (open !== undefined && open !== wasOpen.current && typeof document !== 'undefined') {
    focusedAsItChanged.current = document.activeElement;
  }

  useLayoutEffect(() => {
    if (open === undefined) {
      return;
    }
    const before = wasOpen.current;
    wasOpen.current = open;
    if (open && !before && (before === false || rememberOnMount)) {
      opener.current = remember(focusedAsItChanged.current);
    } else if (!open && before) {
      const from = opener.current;
      opener.current = null;
      // Only when closing took focus away: something had it as the close
      // began, and nothing has it now.
      if (!isNothing(focusedAsItChanged.current)) {
        giveFocusBack(from, fallbackRef.current);
      }
    }
  }, [open, rememberOnMount]);

  useLayoutEffect(() => {
    return () => {
      // With nothing focused, the surface takes no focus away as it goes.
      // That includes StrictMode's rehearsal of an unmount as the page loads,
      // which leaves the surface on the page.
      if (!wasOpen.current || nothingHasFocus()) {
        return;
      }
      const from = opener.current;
      const fallbackNow = fallbackRef.current;
      // This runs before React takes the surface off the page, so focus is
      // still inside it; wait until it has gone.
      queueMicrotask(() => giveFocusBack(from, fallbackNow));
    };
  }, []);

  // Radix moves focus in as the content mounts, or an `autoFocus` field in it
  // does, and either way the element it left is the opener. Only the first
  // entry counts, so content that changes while open, or a dialog opened from
  // inside, leaves the opener alone.
  const onFocus = useCallback((event: FocusEvent) => {
    if (entered.current) {
      return;
    }
    entered.current = true;
    opener.current = remember(event.relatedTarget);
  }, []);

  // Radix calls this once the content has left the page, and runs its own
  // default after it unless prevented: a Dialog focuses its DialogTrigger, if
  // it has one. So the opener goes first, then Radix's default, then where
  // the opener was, each only if the one before placed nothing.
  const onCloseAutoFocus = useCallback((event: Event) => {
    const from = opener.current;
    opener.current = null;
    entered.current = false;
    // Prevented, the caller's own handler has placed focus.
    if (event.defaultPrevented || !nothingHasFocus()) {
      return;
    }
    if (focusOpener(from, fallbackRef.current)) {
      event.preventDefault();
      return;
    }
    // After Radix's default, which runs as this returns.
    queueMicrotask(() => {
      if (nothingHasFocus()) {
        focusNearOpener(from);
      }
    });
  }, []);

  return { onFocus, onCloseAutoFocus };
}
