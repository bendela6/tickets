import { readTokenFile } from './utils/read-token-file.ts';
import type { RadiusDoc } from './utils/types.ts';

/**
 * `styles/generated/radius.css` — four corner rungs, not six.
 *
 * A radius is only legible against the box it rounds: 4px on a chip and 12px on
 * a panel read as the same softness, while 4 and 5 on the same box read as a
 * mistake. The values are Tailwind's own sm/md/lg/xl, so existing usages kept
 * the pixel they already had.
 *
 * `--radius-*: initial` is the enforcement, and it is deliberately the wildcard
 * rather than the four named off-scale rungs it replaced (`xs`, `2xl`, `3xl`,
 * `4xl`). Same result today, but it also catches any rung a future Tailwind
 * adds, instead of silently letting one through.
 *
 * `rounded-full` survives the clear — Tailwind hardcodes it to
 * `calc(infinity * 1px)` rather than reading a token, and a pill is not a step
 * on the scale.
 */
export function generateRadius(indent = '  '): string {
  const { radius } = readTokenFile<RadiusDoc>('radius.tokens.json');

  const rungs = Object.entries(radius)
    .map(([name, token]) => `${indent}--radius-${name}: ${token.$value};\n`)
    .join('');

  return `@theme inline {\n${indent}--radius-*: initial;\n${rungs}}\n`;
}
