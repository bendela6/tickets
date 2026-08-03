import type { TokenMap } from './types.ts';

/**
 * Every token must exist in both themes.
 *
 * This check is why the families are merged before emitting rather than each
 * writing its own region: a per-family check would pass happily while the sheet
 * as a whole was asymmetric. A light-only token would emit a `--color-*` bridge
 * that resolves to nothing in dark mode — an invisible element rather than a
 * build error, which is the failure this exists to convert.
 */
export function assertThemeSymmetry(light: TokenMap, dark: TokenMap): void {
  const lightNames = Object.keys(light);
  const darkNames = Object.keys(dark);
  const lightSet = new Set(lightNames);
  const darkSet = new Set(darkNames);

  const asymmetric = [
    ...lightNames.filter((name) => !darkSet.has(name)).map((name) => `${name} (light only)`),
    ...darkNames.filter((name) => !lightSet.has(name)).map((name) => `${name} (dark only)`),
  ];
  if (asymmetric.length > 0) {
    throw new Error(`light/dark token sets diverge: ${asymmetric.join(', ')}`);
  }
}

/** Merge one family's contribution into the running per-theme maps. */
export function mergeInto(target: { light: TokenMap; dark: TokenMap }, family: { light: TokenMap; dark: TokenMap }): void {
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, token] of Object.entries(family[theme])) {
      if (name in target[theme]) {
        throw new Error(`two families both define the token "${name}" (${theme})`);
      }
      target[theme][name] = token;
    }
  }
}
