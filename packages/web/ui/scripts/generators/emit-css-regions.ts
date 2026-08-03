import { generateLeading } from './generate-leading.ts';
import { colorVarLines } from './utils/color-var-lines.ts';
import { cssLines } from './utils/css-lines.ts';
import { shadowVarLines } from './utils/shadow-var-lines.ts';
import type { TokenMap } from './utils/types.ts';

/**
 * Turn the resolved per-theme maps into the four regenerable regions of
 * tokens.css, keyed by region name.
 *
 * The regions are theme SLOTS, not families: `light` holds colours, surfaces,
 * literals and shadows together. That is why the split here is by token KIND —
 * a colour bridges to `--color-x`, a shadow to `--shadow-x` — rather than by
 * the family that produced it.
 *
 * `leading` is the odd one out: it has no token JSON behind it and no theme
 * dimension, so it is generated straight into its own region.
 */
export function emitCssRegions({ light, dark }: { light: TokenMap; dark: TokenMap }): Record<string, string> {
  const names = Object.keys(light);
  const colorNames = names.filter((name) => light[name]?.type !== 'shadow');
  const shadowNames = names.filter((name) => light[name]?.type === 'shadow');

  return {
    light: cssLines(light),
    dark: cssLines(dark),
    theme: colorVarLines(colorNames) + shadowVarLines(shadowNames),
    leading: generateLeading(),
  };
}
