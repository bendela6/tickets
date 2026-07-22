import { describe, expect, it } from 'vitest';
import { markdownToDoc, toDisplayDoc } from './markdown-to-doc';

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
    expect(types).toContain('bulletList');
    expect(types).toContain('taskList');
    expect(types).toContain('orderedList');
    const task = doc.content!.find((n) => n.type === 'taskList')!.content![0]!;
    expect(task).toMatchObject({ type: 'taskItem', attrs: { checked: true } });
  });

  it('parses fences, tables, and images', () => {
    const doc = markdownToDoc('```\ncode here\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n![alt](/api/attachments/3)');
    const types = (doc.content ?? []).map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(['codeBlock', 'table']));
    expect(JSON.stringify(doc)).toContain('"src":"/api/attachments/3"');
  });

  it('parses ticket refs and mentions as atoms', () => {
    const doc = markdownToDoc('See #TIX-123 and ask @beka.');
    const inline = doc.content![0]!.content!;
    expect(inline.some((n) => n.type === 'ticketRef' && n.attrs?.['label'] === 'TIX-123')).toBe(true);
    expect(inline.some((n) => n.type === 'mention' && n.attrs?.['label'] === 'beka')).toBe(true);
  });

  it('never throws on garbage and legacy heading IDs survive as text', () => {
    expect(() => markdownToDoc('|||\n``` \n **')).not.toThrow();
    const doc = markdownToDoc('# TASK-42: old ticket');
    expect(doc.content?.[0]?.content?.[0]?.text).toContain('TASK-42');
  });
});

describe('toDisplayDoc', () => {
  it('passes docs through and converts markdown', () => {
    const stored = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] });
    expect(toDisplayDoc(stored).content?.[0]?.content?.[0]?.text).toBe('hi');
    expect(toDisplayDoc('# md').content?.[0]?.type).toBe('heading');
  });
});
