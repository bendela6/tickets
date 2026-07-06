import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The Instrument theme defines custom font-size tokens (text-ui / text-meta /
// text-label). tailwind-merge doesn't know they're font sizes, so by default it
// buckets them into the text-COLOR group and silently drops the adjacent color
// utility — e.g. `text-on-accent text-ui` collapses to just `text-ui`, so a
// primary button loses its white text. Register them as font sizes so a color
// token and a size token can safely coexist in the same cn() call.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['ui', 'meta', 'label'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
