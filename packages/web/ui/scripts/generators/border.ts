import { readTokenFile } from './utils/read-token-file.ts';
import { constant, tsModule } from './utils/ts-module.ts';
import type { BorderDoc, Family } from './utils/types.ts';

/**
 * Edge treatment: corner radius, plus the border and ring widths.
 *
 * Only `radius` reaches CSS. Measured: Tailwind has no `--border-width-*` or
 * `--ring-*` theme namespace, so `border-2` is 2px because the class says so —
 * `border-7` and `ring-42` compile to exactly those values, and only fractions
 * are rejected. The width lists cannot be enforced by a token, so they are
 * emitted as TypeScript for the gallery to document and nothing more.
 *
 * Four radius rungs, not six: a radius is only legible against the box it
 * rounds — 4px on a chip and 12px on a panel read as the same softness, while
 * 4 and 5 on the same box read as a mistake.
 *
 * `--radius-*: initial` is the enforcement, deliberately the wildcard rather
 * than the four named off-scale rungs it replaced. Same result for today's
 * Tailwind, but it also catches any rung a future version adds.
 * `rounded-full` survives the clear — Tailwind hardcodes it to
 * `calc(infinity * 1px)` rather than reading a token.
 */
export function generateBorder(indent = '  '): Family {
  const doc = readTokenFile<BorderDoc>('border.tokens.json');

  const rungs = Object.entries(doc.radius)
    .map(([name, value]) => `${indent}--radius-${name}: ${value};\n`)
    .join('');

  return {
    css: `@theme inline {\n${indent}--radius-*: initial;\n${rungs}}\n`,
    ts: tsModule({
      source: 'border.tokens.json',
      summary:
        'WIDTHS and RINGS are documentation, not constraint — Tailwind has no\n' +
        'namespace for either, so any integer compiles whatever this says.',
      declarations: [
        constant('RADII', doc.radius),
        constant('WIDTHS', doc.width),
        constant('RINGS', doc.ring),
      ],
    }),
  };
}
