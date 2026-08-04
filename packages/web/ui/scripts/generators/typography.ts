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
      ],
    }),
  };
}

/**
 * There is no line-height ladder any more, and none is needed.
 *
 * It existed to cover 8..96 because Tailwind resolves the `/N` modifier against
 * `--leading-*` only if that token exists, and otherwise falls through to the
 * SPACING scale. At the old `--spacing: .25rem` that fallback was a trap —
 * `text-13/7` compiled to `calc(var(--spacing) * 7)`, which is 28px, not 7px —
 * so 89 rungs were emitted to make it unreachable.
 *
 * `--spacing: 1px` makes the fallback correct instead: `text-13/19` resolves to
 * `calc(1px * 19)` = 19px, exactly what the ladder used to state, and it works
 * for every integer rather than a fenced range. The ladder became 89 lines
 * asserting what the fallback already does.
 */
