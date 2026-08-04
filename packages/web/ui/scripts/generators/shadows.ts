import { readTokenFile } from './utils/read-token-file.ts';
import { assertThemeSymmetry, shadowVars, themedSheet } from './utils/themed-sheet.ts';
import { constant, tsModule } from './utils/ts-module.ts';
import type { Family, ShadowsDoc, TokenMap } from './utils/types.ts';

/**
 * The elevation scale — xs, md, lg.
 *
 * The one family whose two themes differ in KIND rather than degree: the light
 * theme casts a soft warm-grey shadow, the dark theme a near-opaque black one,
 * because a shadow on a dark surface works by occlusion rather than by tint.
 * That is why each theme states its own rungs instead of one being derived.
 *
 * Rungs are named for size rather than for a job (`raised`/`overlay`/`modal`
 * until 2026-08-04). Six call sites were already reaching for Tailwind's generic
 * `shadow-lg` on dialogs and popovers; naming ours by size means those get the
 * elevation the design intended instead of a coincidence.
 */
export function generateShadows(): Family {
  const doc = readTokenFile<ShadowsDoc>('shadows.tokens.json');

  // The `shadow-` prefix is added here and stripped back off by `shadowVars`:
  // the raw property is `--ins-shadow-xs`, the utility is `shadow-xs`.
  const prefix = (rungs: Record<string, string>): TokenMap =>
    Object.fromEntries(Object.entries(rungs).map(([rung, value]) => [`shadow-${rung}`, value]));

  const light = prefix(doc.light);
  const dark = prefix(doc.dark);
  assertThemeSymmetry('shadows', light, dark);

  return {
    css: themedSheet({ light, dark, bridge: shadowVars }),
    ts: tsModule({
      source: 'shadows.tokens.json',
      summary: 'Both themes are carried, because a shadow is not one value dimmed.',
      declarations: [
        constant('SHADOWS', { light: doc.light, dark: doc.dark }, 'Record<"light" | "dark", Record<string, string>>'),
      ],
    }),
  };
}
