import { Mention } from '@tiptap/extension-mention';
import type { SuggestionOptions } from '@tiptap/suggestion';

export type SuggestionHooks = {
  mention?: Partial<SuggestionOptions>;
  ticketRef?: Partial<SuggestionOptions>;
};

export function userMention(hook?: Partial<SuggestionOptions>) {
  return Mention.configure({
    renderHTML: ({ node }) => ['span', { 'data-mention': node.attrs['label'] }, `@${node.attrs['label']}`],
    suggestion: { char: '@', ...hook },
  });
}

export const TicketRefBase = Mention.extend({ name: 'ticketRef' });

export function ticketRef(hook?: Partial<SuggestionOptions>) {
  return TicketRefBase.configure({
    renderHTML: ({ node }) => ['span', { 'data-ticket-ref': node.attrs['label'] }, `#${node.attrs['label']}`],
    suggestion: { char: '#', ...hook },
  });
}
