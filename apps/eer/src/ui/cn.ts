import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge doesn't know the theme's custom font-size steps: unknown
// text-* utilities fall into the text-COLOR group (so `text-2xs text-gray-400`
// would collapse to one class). Register them as font sizes.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['3xs', '2xs'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
