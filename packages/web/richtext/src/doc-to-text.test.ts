import { describe, expect, it } from 'vitest';
import { docToText } from './doc-to-text';

describe('docToText', () => {
  it('joins blocks with newlines and concatenates inline text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold' },
            { type: 'ticketRef', attrs: { id: 'TIX-1', label: 'TIX-1' } },
          ],
        },
      ],
    };
    expect(docToText(doc)).toBe('Title\nbold TIX-1');
  });
});
