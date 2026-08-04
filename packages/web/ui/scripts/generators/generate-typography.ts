import { generateLeading } from './generate-leading.ts';
import { readTokenFile } from './utils/read-token-file.ts';
import type { TypographyDoc } from './utils/types.ts';

/**
 * `styles/generated/typography.css` — the type scale, weights, families and the
 * line-height ladder.
 *
 * Self-contained: the `initial` clears sit above the values they precede, so
 * this file can be imported in any order relative to its siblings.
 *
 * `--text-*: initial` clears BOTH Tailwind's own scale and the retired role
 * names, so `text-sm` and `text-ui` stop compiling — the old vocabulary cannot
 * drift back. Sizes are deliberately unpaired with line-heights: Tailwind emits
 * the pair only when `--text-N--line-height` exists, so leaving it off makes
 * `text-11` render exactly as `text-[11px]` did.
 *
 * Only 400/500/600 exist as weights, because only those have font files —
 * main.tsx loads Plex Sans 400/500/600 and Plex Mono 400/500. Declaring 700+
 * would let a caller ask for a weight the browser has to synthesise, which is a
 * faked bold rather than the typeface. Adding a rung means adding a @fontsource
 * import first.
 */
export function generateTypography(indent = '  '): string {
  const doc = readTokenFile<TypographyDoc>('typography.tokens.json');

  const sizes = Object.entries(doc.text)
    .map(([step, token]) => `${indent}--text-${step}: ${token.$value};\n`)
    .join('');

  const weights = Object.entries(doc['font-weight'])
    .map(([weight, token]) => `${indent}--font-weight-${weight}: ${token.$value};\n`)
    .join('');

  const families = Object.entries(doc.font)
    .map(([name, token]) => `${indent}--font-${name}: ${token.$value};\n`)
    .join('');

  return (
    `@theme inline {\n` +
    `${indent}--text-*: initial;\n` +
    sizes +
    `\n${indent}--font-weight-*: initial;\n` +
    weights +
    `\n` +
    families +
    `\n` +
    generateLeading(indent) +
    `}\n`
  );
}
