// Turns a preference into the theme to actually paint. `system` is the only one
// that needs asking: the other two already name a theme.

import type { Theme, ThemePreference } from './theme-types';

/** The media query `system` defers to. Exported so watchers subscribe to the same one. */
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * The theme a preference resolves to right now.
 *
 * @param preference `light` and `dark` are themselves; `system` asks `DARK_MEDIA_QUERY`.
 */
export function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== 'system') {
    return preference;
  }
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}
