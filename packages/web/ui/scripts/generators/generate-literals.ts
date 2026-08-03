import { readTokenFile } from './utils/read-token-file.ts';
import type { FamilyTokens, SemanticDoc, TokenMap } from './utils/types.ts';

/**
 * Colours chosen for recognition rather than for a contrast role.
 *
 * `highlight` is a highlighter pen — yellow means "highlighted", and no rung on
 * a perceptual ramp carries that meaning. `black` and `white` are the two
 * absolutes, which a ramp deliberately never reaches.
 *
 * This family is meant to stay small: a literal is a value the system cannot
 * reason about, so every entry is a hole in the ramp discipline. `folder` used
 * to live here for the directory-tree glyph's gold; it was retired onto
 * `yellow-8` (2026-08-04) because one call site's recognition colour did not
 * earn a token the whole system had to carry.
 */
export function generateLiterals(): FamilyTokens {
  const { literal } = readTokenFile<SemanticDoc>('semantic.tokens.json');

  const build = (theme: 'light' | 'dark'): TokenMap => {
    const map: TokenMap = {};
    for (const [name, byTheme] of Object.entries(literal)) {
      map[name] = { value: byTheme[theme], type: 'color' };
    }
    return map;
  };

  return { light: build('light'), dark: build('dark') };
}
