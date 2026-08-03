/**
 * The line-height ladder, in px, for the `text-{size}/{leading}` pairing.
 *
 * Open where the type scale is closed: a size is a design decision and is
 * rationed to twelve rungs; a leading is DERIVED from its size, so there is no
 * drift to prevent by rationing it.
 *
 * The range is exhaustive on purpose, and must STAY exhaustive. Tailwind
 * resolves the `/N` modifier against `--leading-*` only if that token exists,
 * and otherwise falls back to the SPACING scale — `text-22/24` with no
 * `--leading-24` compiles to a 96px line-height (24 x 0.25rem), silently and
 * four times wrong. Covering 8..96 makes that fallback unreachable for any
 * real value.
 *
 * The only generator with no JSON behind it: 89 consecutive integers are a
 * loop, not a set of decisions, and writing them into a token file would just
 * move the typing somewhere else.
 */
const LEADING_MIN = 8;
const LEADING_MAX = 96;

export function generateLeading(indent = '  '): string {
  let out = '';
  for (let n = LEADING_MIN; n <= LEADING_MAX; n++) {
    out += `${indent}--leading-${n}: ${n}px;\n`;
  }
  return out;
}
