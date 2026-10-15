import { getSchema } from '@tiptap/core';
import { Mention } from '@tiptap/extension-mention';
import { describe, expect, it } from 'vitest';
import { createRichText, markdownToDoc, PRESETS, type DocNode, type InlineNode } from './index';

const label = (node: DocNode) => String(node.attrs?.['label'] ?? '');

// An app's own node, as tickets plugs in its ticket reference: `#TIX-123`, a
// chip that opens the ticket, on with mentions.
const ticketRef: InlineNode = {
  name: 'ticketRef',
  feature: 'mentions',
  extensions: (suggestion) => {
    return [
      Mention.extend({ name: 'ticketRef' }).configure({
        renderHTML: ({ node }) => {
          const text = String(node.attrs['label'] ?? '');
          return ['span', { 'data-ticket-ref': text }, text];
        },
        suggestion: { char: '#', ...suggestion },
      }),
    ];
  },
  markdown: {
    pattern: /(?<![\w#])#([A-Z][A-Z0-9]*-\d+)/,
    parse: (match) => ({ type: 'ticketRef', attrs: { id: null, label: match[1] ?? '' } }),
    serialize: (node) => `#${label(node)}`,
  },
};

const tickets = createRichText({ nodes: [ticketRef] });

const paragraphOf = (...content: DocNode[]): DocNode => {
  return { type: 'doc', content: [{ type: 'paragraph', content }] };
};

describe('an app’s own inline node', () => {
  it('is in the editor while its feature is on', () => {
    expect(getSchema(tickets.buildExtensions(PRESETS.full)).nodes['ticketRef']?.spec.inline).toBe(
      true,
    );
    expect(getSchema(tickets.buildExtensions(['marks'])).nodes['ticketRef']).toBeUndefined();
  });

  it('is named among the nodes the rich text knows, after mentions', () => {
    expect(tickets.nodeNames).toEqual(['mention', 'ticketRef']);
    expect(createRichText().nodeNames).toEqual(['mention']);
  });

  it('gets the suggestion hook named for it, and mentions keep theirs', () => {
    const given: unknown[] = [];
    const spy: InlineNode = {
      name: 'spy',
      extensions: (suggestion) => {
        given.push(suggestion);
        return [];
      },
    };
    const items = () => [];
    createRichText({ nodes: [spy] }).buildExtensions(['marks'], { spy: { items }, mention: {} });
    expect(given).toEqual([{ items }]);
  });

  it('is read from markdown and written back, the round trip settling', () => {
    const doc = tickets.markdownToDoc('See #TIX-123 and @beka.');
    const inline = doc.content?.[0]?.content ?? [];
    expect(inline.map((node) => node.type)).toEqual([
      'text',
      'ticketRef',
      'text',
      'mention',
      'text',
    ]);
    expect(inline[1]?.attrs).toEqual({ id: null, label: 'TIX-123' });

    const once = tickets.docToMarkdown(doc);
    expect(once).toBe('See #TIX-123 and @beka.');
    expect(tickets.docToMarkdown(tickets.markdownToDoc(once))).toBe(once);
    expect(tickets.docToMarkdown(tickets.toDisplayDoc(once))).toBe(once);
    expect(tickets.parseInline('#TIX-1')).toEqual([
      { type: 'ticketRef', attrs: { id: null, label: 'TIX-1' } },
    ]);
  });

  it('loads into the editor’s schema as markdown read it', () => {
    const schema = getSchema(tickets.buildExtensions(PRESETS.full));
    const doc = schema.nodeFromJSON(tickets.markdownToDoc('Blocked by #TIX-9.'));
    expect(doc.firstChild?.child(1).type.name).toBe('ticketRef');
  });

  it('is unknown to rich text made without it', () => {
    const inline = markdownToDoc('#TIX-123').content?.[0]?.content;
    expect(inline).toEqual([{ type: 'text', text: '#TIX-123' }]);
  });

  it('gives its words to the plain text, and keeps a document from being empty', () => {
    const doc = paragraphOf(
      { type: 'text', text: 'blocked by' },
      { type: 'ticketRef', attrs: { label: 'TIX-1' } },
    );
    expect(tickets.docToText(doc)).toBe('blocked by TIX-1');
    expect(tickets.isDocEmpty(paragraphOf({ type: 'ticketRef', attrs: { label: 'TIX-1' } }))).toBe(
      false,
    );
  });

  it('without markdown of its own, is written as its words', () => {
    const tag: InlineNode = {
      name: 'tag',
      extensions: () => [],
      text: (node) => `[${String(node.attrs?.['name'] ?? '')}]`,
    };
    const richText = createRichText({ nodes: [tag] });
    const doc = paragraphOf({ type: 'tag', attrs: { name: 'urgent' } });
    expect(richText.docToMarkdown(doc)).toBe('[urgent]');
    expect(richText.docToText(doc)).toBe('[urgent]');
  });

  it('can’t hang the parser with a pattern that matches nothing', () => {
    const empty: InlineNode = {
      name: 'empty',
      extensions: () => [],
      markdown: { pattern: /x*/, parse: () => ({ type: 'empty' }), serialize: () => '' },
    };
    expect(createRichText({ nodes: [empty] }).parseInline('abc')).toEqual([
      { type: 'text', text: 'abc' },
    ]);
  });

  it('is refused with a taken name or a global pattern', () => {
    const named = (name: string, pattern = /x/): InlineNode => {
      return {
        name,
        extensions: () => [],
        markdown: { pattern, parse: () => ({ type: name }), serialize: () => '' },
      };
    };
    expect(() => createRichText({ nodes: [named('mention')] })).toThrow(/Two inline nodes/);
    expect(() => createRichText({ nodes: [named('a'), named('a')] })).toThrow(/Two inline nodes/);
    expect(() => createRichText({ nodes: [named('a', /x/g)] })).toThrow(/global or sticky/);
  });
});
