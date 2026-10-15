import { describe, expect, it } from 'vitest';
import { docToMarkdown, type DocNode } from './index';

const textNode = (t: string, marks?: object[]) => {
  return {
    type: 'text',
    text: t,
    ...(marks ? { marks } : {}),
  };
};
const para = (...content: object[]) => ({ type: 'paragraph', content });
const doc = (...content: object[]) => ({ type: 'doc', content }) as DocNode;

describe('docToMarkdown', () => {
  it('serializes marks, links, mentions and images', () => {
    const md = docToMarkdown(
      doc(
        para(
          textNode('b', [{ type: 'bold' }]),
          textNode(' plain '),
          textNode('x', [{ type: 'link', attrs: { href: 'https://x.dev' } }]),
          textNode(' '),
          { type: 'mention', attrs: { label: 'beka' } },
          textNode(' '),
          { type: 'image', attrs: { src: '/a.png', alt: 'shot' } },
        ),
      ),
    );
    expect(md).toBe('**b** plain [x](https://x.dev) @beka ![shot](/a.png)');
  });

  it('degrades callout and details; drops styling marks', () => {
    const md = docToMarkdown(
      doc(
        { type: 'callout', attrs: { kind: 'warning' }, content: [para(textNode('careful'))] },
        {
          type: 'details',
          content: [
            { type: 'detailsSummary', content: [textNode('More')] },
            { type: 'detailsContent', content: [para(textNode('hidden'))] },
          ],
        },
        para(textNode('plain', [{ type: 'highlight' }, { type: 'underline' }])),
      ),
    );
    expect(md).toContain('> **Warning:** careful');
    expect(md).toContain('**More**');
    expect(md).toContain('hidden');
    expect(md).toContain('plain');
    expect(md).not.toContain('==');
  });

  it('serializes task lists and tables', () => {
    const md = docToMarkdown(
      doc(
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: true }, content: [para(textNode('done'))] },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [{ type: 'tableHeader', content: [para(textNode('h'))] }],
            },
            { type: 'tableRow', content: [{ type: 'tableCell', content: [para(textNode('v'))] }] },
          ],
        },
      ),
    );
    expect(md).toContain('- [x] done');
    expect(md).toContain('| h |');
    expect(md).toContain('| --- |');
    expect(md).toContain('| v |');
  });

  it('quotes a blockquote line by line', () => {
    const md = docToMarkdown(
      doc({ type: 'blockquote', content: [para(textNode('one')), para(textNode('two'))] }),
    );
    expect(md).toBe('> one\n> \n> two');
  });
});
