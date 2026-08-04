import { cssLines } from './utils/css-lines.ts';
import type { TokenMap } from './utils/types.ts';

export interface ThemedCssInput {
  light: TokenMap;
  dark: TokenMap;
  /** Turns the token names into their `@theme` bridge declarations. */
  bridge: (names: string[]) => string;
  /** Emitted at the top of the `@theme` block, e.g. `--color-*: initial`. */
  clear?: string;
}

/**
 * Assemble one theme-varying stylesheet: the raw `--ins-*` values per theme,
 * then the bridge that exposes them under a Tailwind namespace.
 *
 * Colours and shadows share this shape and differ only in which namespace they
 * bridge into — `--color-x` versus `--shadow-x` — so the difference is a
 * parameter rather than a second copy of the file layout.
 *
 * `[data-theme='light']` rides alongside `:root` because `:root` matches only
 * <html>: without it, a light-themed wrapper nested inside a dark subtree would
 * inherit the dark values. That is exactly what the playground's ThemeSplit does.
 */
export function emitThemedCss({ light, dark, bridge, clear }: ThemedCssInput): string {
  const names = Object.keys(light);
  const theme = (clear ? `  ${clear}\n` : '') + bridge(names);

  return (
    `:root, [data-theme='light'] {\n${cssLines(light)}}\n\n` +
    `[data-theme='dark'] {\n${cssLines(dark)}}\n\n` +
    `@theme inline {\n${theme}}\n`
  );
}
