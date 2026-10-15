import { describe, expect, it } from 'vitest';
import { isDocEmpty, isRichDoc, parseDoc, type DocNode } from './index';

const doc = (content: object[]) => JSON.stringify({ type: 'doc', content });
const para = (text?: string) => {
  return { type: 'paragraph', content: text ? [{ type: 'text', text }] : [] };
};

describe('isRichDoc', () => {
  it('accepts a serialized doc', () => {
    expect(isRichDoc(doc([para('hi')]))).toBe(true);
  });
  it('rejects markdown, empty string, and doc-prefixed garbage', () => {
    expect(isRichDoc('# heading\n\ntext')).toBe(false);
    expect(isRichDoc('')).toBe(false);
    expect(isRichDoc('{"type":"doc" oops')).toBe(false);
  });
});

describe('parseDoc', () => {
  it('parses a valid doc and rejects non-docs', () => {
    expect(parseDoc(doc([para('hi')]))?.type).toBe('doc');
    expect(parseDoc('# md')).toBeNull();
    expect(parseDoc('{"type":"paragraph"}')).toBeNull();
  });
});

describe('isDocEmpty', () => {
  it('empty paragraph doc is empty; text or atoms are not', () => {
    expect(isDocEmpty({ type: 'doc', content: [para()] })).toBe(true);
    expect(isDocEmpty({ type: 'doc', content: [para('  ')] })).toBe(true);
    expect(isDocEmpty({ type: 'doc', content: [para('x')] })).toBe(false);
    const holding = (node: DocNode): DocNode => {
      return { type: 'doc', content: [{ type: 'paragraph', content: [node] }] };
    };
    expect(isDocEmpty(holding({ type: 'image', attrs: { src: '/a' } }))).toBe(false);
    expect(isDocEmpty(holding({ type: 'mention', attrs: { label: 'beka' } }))).toBe(false);
  });
});
