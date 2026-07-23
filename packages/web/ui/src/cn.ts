import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Both apps define custom font-size tokens (web: text-ui/meta/label; eer:
// text-3xs/2xs). tailwind-merge doesn't know they're font sizes, so by
// default it buckets them into the text-COLOR group and silently drops the
// adjacent color utility — e.g. `text-on-accent text-ui` collapses to just
// `text-ui`. Register the UNION of both apps' sizes so one shared cn serves
// every consumer.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['ui', 'meta', 'label', '3xs', '2xs'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
