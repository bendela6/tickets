import { useEffect, useState } from 'react';

// Below these a docked panel cannot sit beside the content without squeezing it.
const QUERIES = { md: '(max-width: 767px)', lg: '(max-width: 1023px)' } as const;

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
