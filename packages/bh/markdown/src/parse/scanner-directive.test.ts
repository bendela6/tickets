import { describe, expect, it } from 'vitest';
import { scanBlocks } from './scanner';

const names = new Set(['warning', 'tabs', 'erd']);

describe('scanBlocks — directives', () => {
  it('captures a container directive with attributes', () => {
    const src = [':::warning{title="Careful"}', 'Body **here**.', ':::'].join('\n');
    expect(scanBlocks(src, names)[0]).toEqual({
      kind: 'block',
      syntax: 'directive',
      name: 'warning',
      attrs: { title: 'Careful' },
      body: 'Body **here**.',
      line: 1,
    });
  });

  it('lets four colons wrap three', () => {
    const src = ['::::tabs', ':::warning', 'inner', ':::', '::::'].join('\n');
    expect(scanBlocks(src, names)[0]).toMatchObject({
      name: 'tabs',
      body: ':::warning\ninner\n:::',
    });
  });

  it('leaves an unregistered directive name as a block for the fallback card', () => {
    const src = [':::nosuchthing', 'x', ':::'].join('\n');
    expect(scanBlocks(src, names)[0]).toMatchObject({ kind: 'block', name: 'nosuchthing' });
  });

  it('does not treat colons inside a fence body as a directive', () => {
    const src = ['```erd', ':::not a directive', '```'].join('\n');
    expect(scanBlocks(src, names)[0]).toMatchObject({ name: 'erd', body: ':::not a directive' });
  });

  it('keeps directive syntax inside an unregistered named fence as one markdown segment', () => {
    const src = ['```markdown', ':::warning', 'example text', ':::', '```'].join('\n');
    const segments = scanBlocks(src, names);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      kind: 'markdown',
      text: expect.stringContaining(':::warning'),
    });
  });

  it('keeps directive syntax inside a bare fence as one markdown segment', () => {
    const src = ['```', ':::warning', 'example text', ':::', '```'].join('\n');
    const segments = scanBlocks(src, names);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      kind: 'markdown',
      text: expect.stringContaining(':::warning'),
    });
  });
});
