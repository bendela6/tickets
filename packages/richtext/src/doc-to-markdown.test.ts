import { describe, expect, it } from 'vitest';
import { docToMarkdown } from './doc-to-markdown';

const textNode = (t: string, marks?: object[]) => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const para = (...content: object[]) => ({ type: 'paragraph', content });
const doc = (...content: object[]) => ({ type: 'doc', content }) as never;

describe('docToMarkdown', () => {
  it('serializes marks, links, refs', () => {
    const md = docToMarkdown(doc(para(
      textNode('b', [{ type: 'bold' }]),
      textNode(' plain '),
      textNode('x', [{ type: 'link', attrs: { href: 'https://x.dev' } }]),
      { type: 'ticketRef', attrs: { label: 'TIX-9' } },
    )));
    expect(md).toBe('**b** plain [x](https://x.dev)#TIX-9');
  });

  it('degrades callout and details; drops styling marks', () => {
    const md = docToMarkdown(doc(
      { type: 'callout', attrs: { kind: 'warning' }, content: [para(textNode('careful'))] },
      { type: 'details', content: [
        { type: 'detailsSummary', content: [textNode('More')] },
        { type: 'detailsContent', content: [para(textNode('hidden'))] },
      ] },
      para(textNode('plain', [{ type: 'highlight' }, { type: 'underline' }])),
    ));
    expect(md).toContain('> **Warning:** careful');
    expect(md).toContain('**More**');
    expect(md).toContain('hidden');
    expect(md).toContain('plain');
    expect(md).not.toContain('==');
  });

  it('serializes task lists and tables', () => {
    const md = docToMarkdown(doc(
      { type: 'taskList', content: [
        { type: 'taskItem', attrs: { checked: true }, content: [para(textNode('done'))] },
      ] },
      { type: 'table', content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [para(textNode('h'))] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [para(textNode('v'))] }] },
      ] },
    ));
    expect(md).toContain('- [x] done');
    expect(md).toContain('| h |');
    expect(md).toContain('| --- |');
    expect(md).toContain('| v |');
  });
});
