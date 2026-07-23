import { describe, expect, it } from 'vitest';
import { decodeBody, encodeBody, searchableText } from './rich-content';

const storedDoc = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello', marks: [{ type: 'bold' }] }] }],
});

describe('encodeBody', () => {
  it('markdown encodes to a serialized doc', () => {
    const encoded = encodeBody('**hello**', 'markdown');
    expect(encoded.startsWith('{"type":"doc"')).toBe(true);
  });
  it('rich passes a valid doc through and rejects non-docs', () => {
    expect(encodeBody(storedDoc, 'rich')).toBe(storedDoc);
    expect(() => encodeBody('not a doc', 'rich')).toThrow(/serialized tiptap doc/);
  });
});

describe('decodeBody', () => {
  it('markdown decodes stored docs and passes legacy markdown through', () => {
    expect(decodeBody(storedDoc, 'markdown')).toBe('**hello**');
    expect(decodeBody('# legacy', 'markdown')).toBe('# legacy');
  });
  it('rich returns the doc, converting legacy markdown', () => {
    expect(decodeBody(storedDoc, 'rich')).toBe(storedDoc);
    expect(decodeBody('# legacy', 'rich').startsWith('{"type":"doc"')).toBe(true);
  });
});

describe('searchableText', () => {
  it('extracts plain text from docs, passes markdown through', () => {
    expect(searchableText(storedDoc)).toBe('hello');
    expect(searchableText('plain md')).toBe('plain md');
  });
});
