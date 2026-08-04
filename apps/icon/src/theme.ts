export type Theme = 'light' | 'dark';

const KEY = 'icon:theme';

/**
 * The UI theme, which is deliberately NOT the same thing as the previewed
 * ground. You can inspect a dark icon from a light workspace — §12 of the
 * design turns on exactly that separation — so the artboard's ground lives in
 * the document view state, and this only dresses the chrome.
 */
export function readTheme(): Theme {
  const stored = globalThis.localStorage?.getItem(KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
  globalThis.localStorage?.setItem(KEY, theme);
}
