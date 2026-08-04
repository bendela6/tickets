import { useEffect, useState } from 'react';
import { BREAKPOINTS } from '../../generated';

// Below these a docked panel cannot sit beside the content without squeezing it.
//
// Derived from the breakpoint tokens rather than written out. These were
// `(max-width: 767px)` and `(max-width: 1023px)` until 2026-08-04 — hand-computed
// `md - 1` and `lg - 1`, with nothing linking them to the tokens they came from.
// Moving a breakpoint left the panel on the old one, silently.
//
// `- 1` because `max-width` is inclusive and the token is where the NEXT band
// starts: a viewport of exactly `md` belongs above the boundary, not below it.
const BELOW = (px: number): string => `(max-width: ${px - 1}px)`;

const QUERIES = {
  md: BELOW(BREAKPOINTS.md),
  lg: BELOW(BREAKPOINTS.lg),
} as const;

export type PanelBreakpoint = keyof typeof QUERIES;

function useMediaQuery(query: string | undefined): boolean {
  const [matches, setMatches] = useState(() =>
    query ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (!query) {
      setMatches(false);
      return;
    }
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    onChange();
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function useIsNarrow(breakpoint: PanelBreakpoint | undefined): boolean {
  return useMediaQuery(breakpoint && QUERIES[breakpoint]);
}

// True when the viewport itself is narrower than `px` — the drawer uses it to
// drop a resize handle there is no room to drag.
export function useViewportUnder(px: number): boolean {
  return useMediaQuery(`(max-width: ${px}px)`);
}
