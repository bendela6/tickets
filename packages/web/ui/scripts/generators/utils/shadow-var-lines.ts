const SHADOW_PREFIX = 'shadow-';

/**
 * `--shadow-<rung>: var(--ins-shadow-<rung>);` for every shadow-typed token.
 *
 * Shadows bridge into a different Tailwind namespace than colours —
 * `--shadow-lg`, not `--color-shadow-lg` — so the `shadow-` prefix that the
 * token name carries is stripped back off here. `generateShadows` adds that
 * prefix for exactly this round trip: the JSON says `lg`, the raw custom
 * property is `--ins-shadow-lg`, and the utility Tailwind emits is `shadow-lg`.
 */
export function shadowVarLines(names: string[], indent = '  '): string {
  return names
    .map((name) => `${indent}--shadow-${name.slice(SHADOW_PREFIX.length)}: var(--ins-${name});\n`)
    .join('');
}
