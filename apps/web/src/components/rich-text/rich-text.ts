import { createRichText, type InlineNode } from '@tilewise/richtext';
import { Mention } from '@tiptap/extension-mention';

const labelOf = (attrs: Record<string, unknown> | undefined) => String(attrs?.['label'] ?? '');

const TicketRefBase = Mention.extend({ name: 'ticketRef' });

/**
 * `#KEY`, an item, as the chip `<span data-ticket-ref>`: the one inline node
 * tickets adds beside tilewise's mentions, on with the same `mentions`
 * feature. Which items can be referenced is the app's, through its
 * `ticketRef` suggestion hook.
 */
export const ticketRef: InlineNode = {
  name: 'ticketRef',
  feature: 'mentions',
  extensions: (suggestion) => [
    TicketRefBase.configure({
      renderHTML: ({ node }) => {
        const label = labelOf(node.attrs);
        return ['span', { 'data-ticket-ref': label }, ['span', { 'data-ticket-ref-dot': '' }], label];
      },
      suggestion: { char: '#', ...suggestion },
    }),
  ],
  markdown: {
    pattern: /(?<![\w#])#([A-Z][A-Z0-9]*-\d+)/,
    parse: (match) => ({ type: 'ticketRef', attrs: { id: null, label: match[1] ?? '' } }),
    serialize: (node) => `#${labelOf(node.attrs)}`,
  },
};

// The editor, the views and the activity feed all take these, so what the
// editor writes, markdown reads back and an excerpt shows agree on ticket refs.
export const { buildExtensions, docToText, isDocEmpty, toDisplayDoc } = createRichText({
  nodes: [ticketRef],
});
