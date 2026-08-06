import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { FONT_WEIGHTS, RADII, TEXT_SIZES } from '../generated';

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

// The same trap a third time, in the radius namespace. `rounded-control-xs|md|lg`
// are custom rungs, so tailwind-merge does not recognise them as border-radius
// and will not let a later `rounded-none` evict one — both survive, and which
// wins is left to stylesheet order. Found when read-only stopped being a box:
// its `rounded-none` sat beside the ladder's `rounded-control-md` and the
// corners stayed rounded.
//
// `control-*` is two segments, which the object form does not match on its own,
// so the rungs are registered as whole class names.
const RADIUS_RUNGS = Object.keys(RADII);

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TEXT_SIZES }],
      'font-weight': [{ font: FONT_WEIGHTS }],
      rounded: [{ rounded: RADIUS_RUNGS }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
