import { readTokenFile } from './utils/read-token-file.ts';
import type { FamilyTokens, SemanticDoc, TokenMap } from './utils/types.ts';

/**
 * The two surfaces — `surface-raised` and `surface-inset`.
 *
 * These survive as named tokens precisely because no ramp step can express
 * them: raised is pure white in the light theme, and no gray rung is white.
 * A surface is defined by what it does (sits above / below the page) rather
 * than by a position on a perceptual scale.
 *
 * Unlike the ramps, both theme values live side by side in one file, so this
 * generator reads a single document and splits it rather than reading two.
 */
export function generateSurfaces(): FamilyTokens {
  const { surface } = readTokenFile<SemanticDoc>('semantic.tokens.json');

  const build = (theme: 'light' | 'dark'): TokenMap => {
    const map: TokenMap = {};
    for (const [name, byTheme] of Object.entries(surface)) {
      map[`surface-${name}`] = { value: byTheme[theme], type: 'color' };
    }
    return map;
  };

  return { light: build('light'), dark: build('dark') };
}
