import { Mention } from '@tiptap/extension-mention';
import type { InlineNode } from '../inline-node';

/**
 * A chip's initials: the first letters of the first two words ("Mara K." is
 * MK), or a single word's first two ("beka" is BE).
 */
export function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return (parts[0] ?? '').slice(0, 2).toUpperCase();
}

const labelOf = (attrs: Record<string, unknown> | undefined) => String(attrs?.['label'] ?? '');

/**
 * `@name`, a person, as the chip `<span data-mention>` with their initials.
 * It is an inline node like an app's own, on with the `mentions` feature; who
 * can be mentioned is the app's, through its `mention` suggestion hook.
 */
export const mention: InlineNode = {
  name: 'mention',
  feature: 'mentions',
  extensions: (suggestion) => {
    return [
      Mention.configure({
        renderHTML: ({ node }) => {
          const label = labelOf(node.attrs);
          return [
            'span',
            { 'data-mention': label },
            ['span', { 'data-mention-avatar': '' }, initials(label)],
            label,
          ];
        },
        suggestion: { char: '@', ...suggestion },
      }),
    ];
  },
  markdown: {
    pattern: /(?<!\w)@([A-Za-z][\w-]*(?:\.[\w-]+)*)/,
    parse: (match) => ({ type: 'mention', attrs: { id: null, label: match[1] ?? '' } }),
    serialize: (node) => `@${labelOf(node.attrs)}`,
  },
};
