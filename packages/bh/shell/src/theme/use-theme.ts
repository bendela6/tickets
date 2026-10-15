// Live-synced theme state: every consumer of this hook observes the same
// attributes on <html>, so a change in one place (the sidebar's theme control)
// is reflected everywhere else without a shared store.

import { useEffect, useState } from 'react';
import { useMediaQuery } from '@bh/hooks';
import { applyTheme } from './apply-theme';
import { DARK_MEDIA_QUERY } from './resolve-theme';
import type { Theme, ThemePreference } from './theme-types';

/** What a theme control needs: the raw choice, the painted result, a setter. */
export interface ThemeState {
  /** What the reader picked, from `data-theme-preference`; `system` when nothing was. */
  preference: ThemePreference;
  /** The theme painted, from `data-theme`: what `system` resolved to, or the pick. */
  theme: Theme;
  /** Applies a preference and remembers it under the hook's key (`applyTheme`). */
  setPreference: (next: ThemePreference) => void;
}

/**
 * Reads both halves of the theme currently stamped on the document root.
 * Drawn on a server (a site's static build) there is no root: `system`.
 */
function readRoot(): Pick<ThemeState, 'preference' | 'theme'> {
  const dataset: DOMStringMap =
    typeof document === 'undefined' ? {} : document.documentElement.dataset;
  const { theme, themePreference } = dataset;
  const known = themePreference === 'light' || themePreference === 'dark';
  return {
    theme: theme === 'dark' ? 'dark' : 'light',
    preference: known || themePreference === 'system' ? themePreference : 'system',
  };
}

/**
 * The theme, kept in sync with `<html>` through a `MutationObserver`, so every
 * component using this hook re-renders when the theme changes anywhere —
 * including from another component's setter call. `storageKey` is where the
 * setter remembers the choice; it is the app's own key.
 *
 * @param storageKey The app's own key, the one `applyTheme` was given at start.
 */
export function useTheme(storageKey: string): ThemeState {
  const [state, setState] = useState<Pick<ThemeState, 'preference' | 'theme'>>(readRoot);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setState(readRoot());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-preference'],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  // While the preference is `system` the OS owns the answer, so the app has to
  // follow it as it changes rather than only at boot. Re-applying (instead of
  // setting state) keeps the root attribute authoritative for every consumer.
  const system: Theme = useMediaQuery(DARK_MEDIA_QUERY) ? 'dark' : 'light';
  useEffect(() => {
    if (state.preference === 'system' && state.theme !== system) {
      applyTheme('system', storageKey);
    }
  }, [state.preference, state.theme, system, storageKey]);

  return {
    ...state,
    setPreference: (next) => {
      applyTheme(next, storageKey);
    },
  };
}
