import type { TokenMap } from './types.ts';

export interface ThemedSheetInput {
  light: TokenMap;
  dark: TokenMap;
  /** Turns token names into their `@theme` bridge declarations. */
  bridge: (names: string[]) => string;
  /** Emitted at the top of the `@theme` block, e.g. `--color-*: initial`. */
  clear?: string;
}

/**
 * One theme-varying stylesheet: the raw `--ins-*` values per theme, then the
 * bridge exposing them under a Tailwind namespace.
 *
 * Colours and shadows share this shape and differ only in which namespace they
 * bridge into — `--color-x` versus `--shadow-x` — so the difference is a
 * parameter rather than a second copy of the layout.
 *
 * `[data-theme='light']` rides alongside `:root` because `:root` matches only
 * <html>: without it a light-themed wrapper nested in a dark subtree would
 * inherit dark values, which is exactly what the playground's ThemeSplit does.
 */
export function themedSheet({ light, dark, bridge, clear }: ThemedSheetInput): string {
  const vars = (map: TokenMap): string =>
    Object.entries(map)
      .map(([name, value]) => `  --ins-${name}: ${value};\n`)
      .join('');

  const theme = (clear ? `  ${clear}\n` : '') + bridge(Object.keys(light));

  return (
    `:root, [data-theme='light'] {\n${vars(light)}}\n\n` +
    `[data-theme='dark'] {\n${vars(dark)}}\n\n` +
    `@theme inline {\n${theme}}\n`
  );
}

/** `--color-<name>: var(--ins-<name>);` — the Tailwind palette namespace. */
export const colorVars = (names: string[]): string =>
  names.map((n) => `  --color-${n}: var(--ins-${n});\n`).join('');

/**
 * `--shadow-<rung>: var(--ins-shadow-<rung>);`
 *
 * Shadows bridge into a different namespace than colours, so the `shadow-`
 * prefix the token name carries is stripped back off here. The generator adds
 * it for exactly this round trip: JSON says `lg`, the raw property is
 * `--ins-shadow-lg`, and the utility Tailwind emits is `shadow-lg`.
 */
export const shadowVars = (names: string[]): string =>
  names.map((n) => `  --shadow-${n.slice('shadow-'.length)}: var(--ins-${n});\n`).join('');

/** Split a map of theme pairs into one map per theme. */
export function splitThemes(
  entries: Record<string, { light: string; dark: string }>,
): { light: TokenMap; dark: TokenMap } {
  const light: TokenMap = {};
  const dark: TokenMap = {};
  for (const [name, value] of Object.entries(entries)) {
    light[name] = value.light;
    dark[name] = value.dark;
  }
  return { light, dark };
}

/**
 * Every token must exist in both themes.
 *
 * Runs per family now that each owns its own stylesheet and namespace — a
 * light-only shadow can no longer hide among the colours. A missing dark value
 * would emit a bridge that resolves to nothing in dark mode: an invisible
 * element rather than a build error, which is the failure this converts.
 */
export function assertThemeSymmetry(family: string, light: TokenMap, dark: TokenMap): void {
  const lightNames = Object.keys(light);
  const darkNames = Object.keys(dark);
  const inDark = new Set(darkNames);
  const inLight = new Set(lightNames);

  const asymmetric = [
    ...lightNames.filter((n) => !inDark.has(n)).map((n) => `${n} (light only)`),
    ...darkNames.filter((n) => !inLight.has(n)).map((n) => `${n} (dark only)`),
  ];
  if (asymmetric.length > 0) {
    throw new Error(`${family}: light/dark token sets diverge — ${asymmetric.join(', ')}`);
  }
}
