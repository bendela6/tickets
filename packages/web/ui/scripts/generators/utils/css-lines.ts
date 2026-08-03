import type { TokenMap } from './types.ts';

/**
 * The `--ins-*` declaration for every token in a theme map.
 *
 * `--ins-` is the raw layer: one custom property per resolved value, declared
 * twice in the sheet (once under `:root`, once under `[data-theme='dark']`).
 * Nothing styles against these directly — `colorVarLines` / `shadowVarLines`
 * bridge them into the names Tailwind actually reads.
 */
export function cssLines(map: TokenMap, indent = '  '): string {
  return Object.entries(map)
    .map(([name, { value }]) => `${indent}--ins-${name}: ${value};\n`)
    .join('');
}
