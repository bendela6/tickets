import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge doesn't know the theme's custom token names: unknown text-*
// utilities fall into the text-COLOR group (so `text-2xs text-dim` would
// collapse to one class), and the named shadows wouldn't conflict with each
// other (so `shadow-card shadow-card-selected` would emit both and leave CSS
// order to pick the winner). Register them explicitly.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['3xs', '2xs'] }],
      shadow: [{ shadow: ['card', 'card-selected', 'overlay', 'port-glow'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
