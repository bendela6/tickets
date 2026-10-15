import { describe, expect, it } from 'vitest';
import { docToText } from './index';

describe('docToText', () => {
  it('joins blocks with newlines and concatenates inline text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'ask' },
            { type: 'mention', attrs: { id: 7, label: 'beka' } },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
            },
          ],
        },
      ],
    };
    expect(docToText(doc)).toBe('Title\nask beka\none');
  });
});
