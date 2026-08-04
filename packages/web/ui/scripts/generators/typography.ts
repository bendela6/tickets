import { readTokenFile } from './utils/read-token-file.ts';
import { constant, tsModule } from './utils/ts-module.ts';
import type { Family, TypographyDoc } from './utils/types.ts';

/**
 * The type scale, weights, families and the line-height ladder.
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
 * faked bold rather than the typeface.
 */
export function generateTypography(indent = '  '): Family {
  const doc = readTokenFile<TypographyDoc>('typography.tokens.json');

  const decls = (entries: Record<string, { $value: string }>, prefix: string): string =>
    Object.entries(entries)
      .map(([key, token]) => `${indent}--${prefix}-${key}: ${token.$value};\n`)
      .join('');

  return {
    css:
      `@theme inline {\n` +
      `${indent}--text-*: initial;\n` +
      decls(doc.text, 'text') +
      `\n${indent}--font-weight-*: initial;\n` +
      decls(doc['font-weight'], 'font-weight') +
      `\n` +
      decls(doc.font, 'font') +
      `\n` +
      leadingLadder(indent) +
      `}\n`,
    ts: tsModule({
      source: 'typography.tokens.json',
      summary:
        'TEXT_SIZES also feeds cn(): tailwind-merge cannot tell a custom\n' +
        'font-size token from a text COLOUR, so an unregistered size silently\n' +
        'drops the adjacent colour utility.',
      declarations: [
        constant('TEXT_SIZES', Object.keys(doc.text)),
        constant('FONT_WEIGHTS', Object.keys(doc['font-weight'])),
        constant('FONT_FAMILIES', Object.fromEntries(Object.entries(doc.font).map(([k, v]) => [k, v.$value]))),
        constant('LEADING_RANGE', { min: LEADING_MIN, max: LEADING_MAX }),
      ],
    }),
  };
}

/**
 * The line-height ladder, in px, for the `text-{size}/{leading}` pairing.
 *
 * Open where the type scale is closed: a size is a design decision and is
 * rationed; a leading is DERIVED from its size, so there is no drift to prevent
 * by rationing it.
 *
 * The range is exhaustive on purpose and must STAY exhaustive. Measured:
 * Tailwind resolves the `/N` modifier against `--leading-*` only if that token
 * exists, and otherwise falls through to the SPACING scale — `text-13/7`
 * compiles to `calc(var(--spacing) * 7)`, which is 28px, not 7px. Covering
 * 8..96 makes that fallback unreachable for any plausible value.
 */
const LEADING_MIN = 8;
const LEADING_MAX = 96;

function leadingLadder(indent: string): string {
  let out = '';
  for (let n = LEADING_MIN; n <= LEADING_MAX; n++) out += `${indent}--leading-${n}: ${n}px;\n`;
  return out;
}
