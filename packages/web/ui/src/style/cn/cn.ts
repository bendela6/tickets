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
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'label',
            'meta',
            'ui',
            'nano',
            'micro',
            'body',
            'title',
            'heading',
            'display',
            '3xs',
            '2xs',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
