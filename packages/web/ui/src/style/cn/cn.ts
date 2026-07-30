import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The app defines custom font-size tokens (the numeric scale below).
// tailwind-merge doesn't know they're font sizes, so by default it buckets them
// into the text-COLOR group and silently drops the adjacent color utility —
// e.g. `text-indigo-contrast text-13` collapses to just `text-13`. Registering
// them here is what keeps one shared cn correct for every consumer.
//
// This list MUST cover every `--text-*` token in tokens.css: a size missing
// here fails silently, and only at the call sites that pair it with a color.
// cn.test.ts reads tokens.css and pins the two lists together.
//
// The `text-13/19` pairing form needs no extra entry — tailwind-merge parses
// the modifier off the base utility, so registering `13` covers both.
/** The type scale. Closed on purpose: a size is a design decision, and
 *  admitting every integer would be arbitrary values with nicer syntax. */
const TEXT_SIZES = ['9', '10', '11', '12', '13', '14', '15', '16', '18', '20', '22', '24'];

/** Same trap as the sizes, one namespace over: `font-*` serves BOTH family
 *  and weight, so an unregistered `font-500` is read as a family and evicts
 *  `font-sans` — verified: `twMerge('font-sans font-400')` yields `font-400`.
 *  Tailwind's own names (medium/semibold) are known and need no entry; these
 *  numeric ones do. */
const FONT_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TEXT_SIZES }],
      'font-weight': [{ font: FONT_WEIGHTS }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
