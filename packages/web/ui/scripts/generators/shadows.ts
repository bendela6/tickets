import { readTokenFile } from './utils/read-token-file.ts';
import { assertThemeSymmetry, shadowVars, splitThemes, themedSheet } from './utils/themed-sheet.ts';
import { constant, tsModule } from './utils/ts-module.ts';
import type { Family, ShadowsDoc, Themed } from './utils/types.ts';

/**
 * The elevation scale — xs, md, lg.
 *
 * The one family whose two themes differ in KIND rather than degree: the light
 * theme casts a soft warm-grey shadow, the dark theme a near-opaque black one,
 * because a shadow on a dark surface works by occlusion rather than by tint.
 *
 * Rungs are named for size rather than for a job (`raised`/`overlay`/`modal`
 * until 2026-08-04). Six call sites were already reaching for Tailwind's generic
 * `shadow-lg` on dialogs and popovers; naming ours by size means those get the
 * elevation the design intended instead of a coincidence.
 */
export function generateShadows(): Family {
  const { shadow } = readTokenFile<ShadowsDoc>('shadows.tokens.json');

  // The `shadow-` prefix is added here and stripped back off by `shadowVars`:
  // the raw property is `--ins-shadow-xs`, the utility is `shadow-xs`.
  const prefixed: Record<string, Themed> = {};
  for (const [rung, value] of Object.entries(shadow)) prefixed[`shadow-${rung}`] = value;

  const { light, dark } = splitThemes(prefixed);
  assertThemeSymmetry('shadows', light, dark);

  return {
    css: themedSheet({ light, dark, bridge: shadowVars }),
    ts: tsModule({
      source: 'shadows.tokens.json',
      summary: 'Both themes are carried, because a shadow is not one value dimmed.',
      declarations: [constant('SHADOWS', shadow)],
    }),
  };
}
