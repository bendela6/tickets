import { describe, expect, it } from 'vitest';
import { scanBlocks } from './scanner';

const names = new Set(['erd', 'transcript']);

describe('scanBlocks — fences', () => {
  it('captures a registered fence as a block', () => {
    const src = ['# Title', '', '```erd', 'title: Core', '```', '', 'After.'].join('\n');
    expect(scanBlocks(src, names)).toEqual([
      { kind: 'markdown', text: '# Title\n', line: 1 },
      { kind: 'block', syntax: 'fence', name: 'erd', attrs: {}, body: 'title: Core', line: 3 },
      { kind: 'markdown', text: '\nAfter.', line: 6 },
    ]);
  });

  it('leaves an unregistered fence inside the markdown segment', () => {
    const src = ['```ts', 'const a = 1;', '```'].join('\n');
    const segments = scanBlocks(src, names);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('markdown');
  });

  it('does not close a block on a shorter fence inside it', () => {
    const src = ['````transcript', '```', 'nested', '```', '````'].join('\n');
    expect(scanBlocks(src, names)[0]).toMatchObject({
      kind: 'block',
      name: 'transcript',
      body: '```\nnested\n```',
    });
  });

  it('treats an unterminated block as running to end of input', () => {
    const src = ['```erd', 'title: Core'].join('\n');
    expect(scanBlocks(src, names)[0]).toMatchObject({ kind: 'block', body: 'title: Core' });
  });

  it('strips carriage returns so CRLF sources scan identically', () => {
    const crlf = ['```transcript', '$ ls', '    indented', '```'].join('\r\n');
    expect(scanBlocks(crlf, names)[0]).toMatchObject({
      kind: 'block',
      name: 'transcript',
      body: '$ ls\n    indented',
    });
  });

  it('reads attributes off a fence info line the way a directive does', () => {
    const src = ['```erd{title="Core schema" zoom=2}', 'tables: {}', '```'].join('\n');
    expect(scanBlocks(src, names)[0]).toMatchObject({
      kind: 'block',
      name: 'erd',
      attrs: { title: 'Core schema', zoom: '2' },
    });
  });

  it('still leaves an unregistered fence with attributes in the markdown', () => {
    const src = ['```ts{file=x.ts}', 'const a = 1;', '```'].join('\n');
    expect(scanBlocks(src, names)[0]?.kind).toBe('markdown');
  });

  it('reads a word before the name as the language, into `lang`', () => {
    const src = ['```yaml erd{title=Core}', 'tables: {}', '```'].join('\n');
    expect(scanBlocks(src, names)[0]).toMatchObject({
      kind: 'block',
      name: 'erd',
      attrs: { lang: 'yaml', title: 'Core' },
      body: 'tables: {}',
    });
  });

  it('lets the braces set `lang` over the word before the name', () => {
    const src = ['```yaml erd{lang=json}', '{}', '```'].join('\n');
    expect(scanBlocks(src, names)[0]).toMatchObject({ name: 'erd', attrs: { lang: 'json' } });
  });

  it('reads a name followed by spaced braces as the name, not a language', () => {
    const src = ['```erd {zoom=2}', 'tables: {}', '```'].join('\n');
    expect(scanBlocks(src, names)[0]).toMatchObject({
      kind: 'block',
      name: 'erd',
      attrs: { zoom: '2' },
    });
  });

  it('leaves a language before an unregistered name in the markdown', () => {
    const src = ['```ts nosuch', 'const a = 1;', '```', '', 'After.'].join('\n');
    expect(scanBlocks(src, names)).toEqual([
      { kind: 'markdown', text: '```ts nosuch\nconst a = 1;\n```\n\nAfter.', line: 1 },
    ]);
  });
});
