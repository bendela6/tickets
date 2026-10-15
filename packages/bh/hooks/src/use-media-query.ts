import { useCallback, useSyncExternalStore } from 'react';

/** What `useMediaQuery` takes after the query. */
export interface UseMediaQueryOptions {
  /** What it is on a server, and in a browser with no `matchMedia`: `false` unless given. */
  serverValue?: boolean;
}

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/**
 * Whether a CSS media query matches now, and again whenever that changes: a
 * narrow viewport, a dark system theme, a pointer that can hover. A hook
 * can't be called on a condition, so `undefined` is a query that matches
 * nothing.
 *
 * Its server value is `serverValue`, `false` unless given: an app that
 * renders only in the browser has the real answer on its first render, a
 * hydrated page right after it.
 *
 * @param query A media query, as `(max-width: 767px)`, or `undefined`.
 * @returns Whether it matches.
 */
export function useMediaQuery(
  query: string | undefined,
  { serverValue = false }: UseMediaQueryOptions = {},
): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!query || !hasMatchMedia()) {
        return () => undefined;
      }
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    // Asked afresh each time, as the browser keeps the answer.
    () => {
      if (!query) {
        return false;
      }
      return hasMatchMedia() ? window.matchMedia(query).matches : serverValue;
    },
    () => (query ? serverValue : false),
  );
}
