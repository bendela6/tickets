import { describe, expect, it } from 'vitest';
import { markdownToDoc, toDisplayDoc } from './index';

describe('markdownToDoc', () => {
  it('parses headings, paragraphs, and inline marks', () => {
    const doc = markdownToDoc('## Title\n\nSome **bold** and `code` and [a link](https://x.dev).');
    expect(doc.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    const inline = doc.content?.[1]?.content ?? [];
    expect(inline.some((n) => n.marks?.some((m) => m.type === 'bold'))).toBe(true);
    expect(inline.some((n) => n.marks?.some((m) => m.type === 'code'))).toBe(true);
    expect(inline.some((n) => n.marks?.some((m) => m.type === 'link'))).toBe(true);
  });

  it('parses bullet, ordered, and task lists', () => {
    const doc = markdownToDoc('- a\n- [x] done\n- [ ] open\n\n1. one');
    const types = (doc.content ?? []).map((n) => n.type);
    expect(types).toEqual(['bulletList', 'taskList', 'orderedList']);
    const tasks = doc.content?.find((n) => n.type === 'taskList')?.content;
    expect(tasks?.[0]).toMatchObject({ type: 'taskItem', attrs: { checked: true } });
    expect(tasks?.[1]).toMatchObject({ type: 'taskItem', attrs: { checked: false } });
  });

  it('parses fences, tables, and images', () => {
    const doc = markdownToDoc(
      '```\ncode here\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n![alt](/api/attachments/3)',
    );
    const types = (doc.content ?? []).map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(['codeBlock', 'table']));
    const table = doc.content?.find((n) => n.type === 'table');
    expect(table?.content?.map((row) => row.content?.[0]?.type)).toEqual([
      'tableHeader',
      'tableCell',
    ]);
    expect(JSON.stringify(doc)).toContain('"src":"/api/attachments/3"');
  });

  it('parses mentions as atoms, and leaves a # it has no node for as text', () => {
    const inline = markdownToDoc('See #TIX-123 and ask @beka.').content?.[0]?.content ?? [];
    expect(inline.some((n) => n.type === 'mention' && n.attrs?.['label'] === 'beka')).toBe(true);
    expect(inline.map((n) => n.text ?? '').join('')).toContain('#TIX-123');
  });

  it('never throws on garbage and legacy heading IDs survive as text', () => {
    expect(() => markdownToDoc('|||\n``` \n **')).not.toThrow();
    const doc = markdownToDoc('# TASK-42: old ticket');
    expect(doc.content?.[0]?.content?.[0]?.text).toContain('TASK-42');
  });

  it('gives an empty text one empty paragraph', () => {
    expect(markdownToDoc('')).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    });
  });
});

describe('toDisplayDoc', () => {
  it('passes docs through and converts markdown', () => {
    const stored = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
    });
    expect(toDisplayDoc(stored).content?.[0]?.content?.[0]?.text).toBe('hi');
    expect(toDisplayDoc('# md').content?.[0]?.type).toBe('heading');
  });
});
