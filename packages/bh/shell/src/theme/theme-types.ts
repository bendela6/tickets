// The theme's two vocabularies: what the stylesheet paints, and what the user
// picked.

/** The two themes Instrument's `dark:` variant knows — what `data-theme` carries. */
export type Theme = 'light' | 'dark';

/** What the user picked. `system` defers to the OS and re-resolves as the OS changes. */
export type ThemePreference = Theme | 'system';
