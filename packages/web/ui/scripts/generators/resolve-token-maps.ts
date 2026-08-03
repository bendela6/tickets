import { generateColors } from './generate-colors.ts';
import { generateLiterals } from './generate-literals.ts';
import { generateShadows } from './generate-shadows.ts';
import { generateSurfaces } from './generate-surfaces.ts';
import { assertThemeSymmetry, mergeInto } from './utils/assert-theme-symmetry.ts';
import type { TokenMap } from './utils/types.ts';

/**
 * The families that contribute `--ins-*` tokens, in emission order.
 *
 * Order is the order they appear in tokens.css, so it is a readability
 * decision rather than a correctness one — except that it must stay stable, or
 * every regeneration produces a diff of moved lines.
 *
 * Adding a family is a new `generate-*.ts` plus one entry here.
 */
const FAMILIES = [generateColors, generateSurfaces, generateLiterals, generateShadows];

/**
 * Resolve every emitted family into `name -> { value, type }` per theme.
 *
 * The single source of truth for token resolution. The design-doc parity check
 * used to call this too; it was deleted 2026-08-04, so the CSS build is now the
 * only caller — kept exported because a second consumer is the normal case for
 * this function, not an unusual one.
 *
 * Merging before emitting is what makes the symmetry check meaningful — a
 * per-family check would pass while the sheet as a whole was asymmetric.
 */
export function resolveTokenMaps(): { light: TokenMap; dark: TokenMap } {
  const maps = { light: {} as TokenMap, dark: {} as TokenMap };
  for (const generate of FAMILIES) mergeInto(maps, generate());
  assertThemeSymmetry(maps.light, maps.dark);
  return maps;
}
