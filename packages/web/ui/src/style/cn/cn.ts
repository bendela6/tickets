import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge, validators } from 'tailwind-merge';
import { FONT_WEIGHTS, TEXT_SIZES } from '../generated';

// The app defines custom font-size tokens. tailwind-merge doesn't know they're
// font sizes, so by default it buckets them into the text-COLOR group and
// silently drops the adjacent color utility — `text-indigo-contrast text-13`
// collapses to just `text-13`. Registering them is what keeps one shared cn
// correct for every consumer.
//
// Both lists come from `src/style/generated`, so they cannot fall behind the scale.
// They were hand-copied until 2026-08-04, kept honest by a test that read the
// stylesheet back and compared — a test standing in for an import.
//
// The `text-13/19` pairing form needs no extra entry: tailwind-merge parses the
// modifier off the base utility, so registering `13` covers both.
//
// `font-*` serves BOTH family and weight, which is the same trap one namespace
// over: an unregistered `font-500` is read as a family and evicts `font-sans` —
// verified, `twMerge('font-sans font-400')` yields `font-400`. Only the three
// weights with font files are registered, because only those compile to
// anything; a `font-700` nobody can produce needs no protection.

// The same trap a third time, in the radius namespace. Radius is spelled as a
// pixel count here (`rounded-6`, not `rounded-md`), and tailwind-merge's stock
// border-radius group accepts `isTshirtSize` — which matches `md` and `2xl` but
// NOT a bare number. An unrecognised rung is not an error: it lands in no group,
// the eviction silently does not happen, and both classes survive with
// stylesheet order deciding. Found when read-only stopped being a box — its
// `rounded-none` sat beside the ladder's rung and the corners stayed rounded.
//
// `isInteger` rather than `isNumber` because that is what actually compiles:
// `rounded-4.5` emits no rule at all, the same way `ring-1.5` does not.
//
// All FIFTEEN groups, not just `rounded`: the corner utilities are separate
// groups in tailwind-merge, so registering only the all-corners one leaves
// `rounded-t-4 rounded-t-none` keeping both. Under the old t-shirt spelling
// those fourteen came free from `isTshirtSize`, which is exactly why the gap
// would not have been noticed.
const RADIUS = [validators.isInteger];
const CORNERS = [
  'rounded-s',
  'rounded-e',
  'rounded-t',
  'rounded-r',
  'rounded-b',
  'rounded-l',
  'rounded-ss',
  'rounded-se',
  'rounded-ee',
  'rounded-es',
  'rounded-tl',
  'rounded-tr',
  'rounded-br',
  'rounded-bl',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TEXT_SIZES }],
      'font-weight': [{ font: FONT_WEIGHTS }],
      rounded: [{ rounded: RADIUS }],
      ...Object.fromEntries(CORNERS.map((corner) => [corner, [{ [corner]: RADIUS }]])),
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
