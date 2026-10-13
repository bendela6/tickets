// Stamps the theme on <html> and remembers the choice. The app calls it before
// the first render (with what readStoredTheme found) and the theme control calls
// it on every change.

import { resolveTheme } from './resolve-theme';
import type { ThemePreference } from './theme-types';

/**
 * Applies a preference to the document root and stores it under the app's key.
 *
 * Both halves are stamped: `data-theme` is the resolved theme the stylesheet
 * reads, `data-theme-preference` is the raw choice. The preference is on the
 * root too because it is what the theme control renders as selected, and
 * keeping it there means every consumer of `useTheme` observes the same source
 * rather than holding a private copy a sibling's change would leave stale.
 *
 * @param preference What the reader picked; `system` is resolved from the OS.
 * @param storageKey The app's own key, e.g. `myapp-theme`. A failed write is ignored.
 */
export function applyTheme(preference: ThemePreference, storageKey: string): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(preference);
  root.dataset.themePreference = preference;
  try {
    localStorage.setItem(storageKey, preference);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this page.
  }
}
