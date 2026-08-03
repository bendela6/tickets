import type { Marker } from './types.ts';

/**
 * Replace the body of one marker pair with freshly generated lines.
 *
 * The markers sit two spaces in, so the replacement re-establishes that
 * indentation itself rather than trusting whatever was there before — which is
 * what makes the splice idempotent regardless of prior contents.
 *
 * A missing marker throws rather than appending: tokens.css is hand-authored
 * around these regions, and silently writing a region to the wrong place would
 * be far harder to notice than a failed build.
 */
export function spliceRegion(css: string, { start, end }: Marker, body: string, indent = '  '): string {
  const startIdx = css.indexOf(start);
  if (startIdx === -1) {
    throw new Error(`Marker not found in tokens.css: ${start}`);
  }
  const afterStart = startIdx + start.length;
  if (css.indexOf(start, afterStart) !== -1) {
    throw new Error(`Duplicate start marker found in tokens.css (corruption?): ${start}`);
  }
  const endIdx = css.indexOf(end, afterStart);
  if (endIdx === -1) {
    throw new Error(`Marker not found in tokens.css: ${end}`);
  }
  return css.slice(0, afterStart) + '\n' + body + indent + css.slice(endIdx);
}
