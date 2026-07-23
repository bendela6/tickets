import { Mention } from '@tiptap/extension-mention';
import type { SuggestionOptions } from '@tiptap/suggestion';

export type SuggestionHooks = {
  mention?: Partial<SuggestionOptions>;
  ticketRef?: Partial<SuggestionOptions>;
};

// Design (RichTextEditor.dc.html §04, "committed chips"): "Mara K." -> "MK"
// (first char of first two words); a single word takes its own first two
// chars, e.g. "beka" -> "BE".
export function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return (parts[0] ?? '').slice(0, 2).toUpperCase();
}

export function userMention(hook?: Partial<SuggestionOptions>) {
  return Mention.configure({
    renderHTML: ({ node }) => {
      const label = String(node.attrs['label'] ?? '');
      return ['span', { 'data-mention': label }, ['span', { 'data-mention-avatar': '' }, initials(label)], label];
    },
    suggestion: { char: '@', ...hook },
  });
}

export const TicketRefBase = Mention.extend({ name: 'ticketRef' });

export function ticketRef(hook?: Partial<SuggestionOptions>) {
  return TicketRefBase.configure({
    renderHTML: ({ node }) => {
      const label = String(node.attrs['label'] ?? '');
      return ['span', { 'data-ticket-ref': label }, ['span', { 'data-ticket-ref-dot': '' }], label];
    },
    suggestion: { char: '#', ...hook },
  });
}
