import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Both apps define custom font-size tokens (web: text-ui/meta/label and the
// extended nano..display scale; eer: text-3xs/2xs). tailwind-merge doesn't
// know they're font sizes, so by default it buckets them into the text-COLOR
// group and silently drops the adjacent color utility — e.g.
// `text-indigo-contrast text-ui` collapses to just `text-ui`. Register the UNION of
// both apps' sizes so one shared cn serves every consumer.
//
// This list MUST cover every `--text-*` token in tokens.css: a size missing
// here fails silently, and only at the call sites that pair it with a color.
// cn.test.ts reads tokens.css and pins the two lists together.
/** The numeric scale the app is migrating to. */
const TEXT_SIZES = ['9', '10', '11', '12', '13', '14', '15', '16', '20', '24'];

/** The named scale it is migrating from. Delete once the sweep is done and
 *  `--text-*: initial` has removed the utilities. */
const LEGACY_TEXT_SIZES = [
  'label',
  'meta',
  'ui',
  'nano',
  'micro',
  'body',
  'title',
  'heading',
  'display',
];

/** eer keeps its own scale — it has its own `@theme` and never loads this
 *  package's tokens.css, but it does share this `cn`. */
const EER_TEXT_SIZES = ['3xs', '2xs'];

/** Same trap as the sizes, one namespace over: `font-*` serves BOTH family
 *  and weight, so an unregistered `font-500` is read as a family and evicts
 *  `font-sans` — verified: `twMerge('font-sans font-400')` yields `font-400`.
 *  Tailwind's own names (medium/semibold) are known and need no entry; these
 *  numeric ones do. */
const FONT_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TEXT_SIZES, ...LEGACY_TEXT_SIZES, ...EER_TEXT_SIZES] }],
      'font-weight': [{ font: FONT_WEIGHTS }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
