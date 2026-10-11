import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { createRegistry } from '../registry/registry';
import type { AnyRenderer } from '../registry/types';
import { editPage, pageItem } from './edit-page';
import { parsePage } from './parse-page';

const component = () => null;

const RENDERERS: AnyRenderer[] = [
  {
    name: 'code',
    body: 'text',
    description: 'Code.',
    attributes: {
      lang: { description: 'The language.' },
      numbers: { description: 'The gutter.', type: 'boolean' },
    },
    examples: ['x'],
    component,
  },
  {
    name: 'example',
    body: 'text',
    description: 'An example.',
    main: 'file',
    attributes: {
      file: { description: 'Its file.' },
      mode: { description: 'How it opens.', values: ['split', 'source'] },
      collapse: { description: 'Lines shown.', type: 'number' },
    },
    examples: ['x'],
    component,
  },
  {
    name: 'note',
    body: 'data',
    description: 'A note.',
    schema: v.object({ type: v.string(), title: v.string() }),
    examples: ['x'],
    component,
  },
  { name: 'aside', body: 'markdown', description: 'An aside.', examples: ['x'], component },
];
const registry = createRegistry(RENDERERS);

const page = (...lines: string[]) => `${lines.join('\n')}\n`;

const CARD = page(
  '# The page about cards.',
  'title: Card',
  "summary: 'A box: one thing in it.'",
  'related: [Box, Panel]',
  'body:',
  '  - |',
  '    A card holds **one** thing.',
  '  - h2: Usage',
  '  - code: import { Card } from "x";',
  '    lang: tsx',
  '  # The examples, in the order a reader needs them.',
  '  - example: examples/plain.tsx',
  '    mode: split # opens on both',
  '    collapse: 6',
  '  - note:',
  '      type: tip # one of five',
  '      title: Keep it short',
);

describe('editPage', () => {
  it('writes an unedited page back exactly as it was', () => {
    expect(editPage(CARD, [])).toBe(CARD);
  });

  it('changes prose, keeping it under a `|`', () => {
    const out = editPage(CARD, [{ op: 'set', index: 0, item: 'A card holds two things.' }]);
    expect(out).toBe(CARD.replace('**one** thing', 'two things'));
  });

  it("changes a block's attribute, keeping the comments and the rest of it", () => {
    const item = { example: 'examples/plain.tsx', mode: 'source', collapse: 6 };
    const out = editPage(CARD, [{ op: 'set', index: 3, item }]);
    expect(out).toBe(CARD.replace('mode: split', 'mode: source'));
  });

  it("changes one field of a block's data, and drops one no longer given", () => {
    const out = editPage(CARD, [
      { op: 'set', index: 4, item: { note: { type: 'warning', title: 'Keep it short' } } },
      { op: 'set', index: 3, item: { example: 'examples/plain.tsx', mode: 'split' } },
    ]);
    expect(out).toBe(CARD.replace('type: tip', 'type: warning').replace('    collapse: 6\n', ''));
  });

  it('replaces an item that becomes another block', () => {
    const out = editPage(CARD, [{ op: 'set', index: 3, item: { code: 'a\nb\n', lang: 'ts' } }]);
    expect(out).toContain('  - code: |\n      a\n      b\n    lang: ts\n');
    expect(out).not.toContain('examples/plain.tsx');
  });

  it('inserts prose and blocks, writing text over two lines with `|`', () => {
    const out = editPage(CARD, [
      { op: 'insert', index: 1, item: 'One line.' },
      { op: 'insert', index: 6, item: { h2: 'More' } },
    ]);
    expect(out).toContain('    A card holds **one** thing.\n  - |\n    One line.\n  - h2: Usage\n');
    expect(out.trimEnd().endsWith('  - h2: More')).toBe(true);
  });

  it('removes an item, and moves one with the comment above it', () => {
    const out = editPage(CARD, [
      { op: 'remove', index: 1 },
      { op: 'move', from: 2, to: 0 },
    ]);
    expect(out).toContain(
      [
        'body:',
        '  # The examples, in the order a reader needs them.',
        '  - example: examples/plain.tsx',
        '    mode: split # opens on both',
        '    collapse: 6',
        '  - |',
      ].join('\n'),
    );
    expect(out).not.toContain('h2: Usage');
  });

  it('changes the frontmatter, adding a field above `body`', () => {
    const out = editPage(CARD, [
      { op: 'meta', key: 'summary', value: 'A box: two things.' },
      { op: 'meta', key: 'order', value: 2 },
      { op: 'meta', key: 'related', value: undefined },
    ]);
    expect(out).toContain("summary: 'A box: two things.'\norder: 2\nbody:\n");
    expect(out).toContain('# The page about cards.\ntitle: Card\n');
  });

  it('refuses an item the page does not have, and a page that does not parse', () => {
    expect(() => editPage(CARD, [{ op: 'remove', index: 5 }])).toThrow(/Item 5 .* it has 5/);
    expect(() => editPage('title: [', [])).toThrow(/doesn't parse/);
    expect(() => editPage(CARD, [{ op: 'meta', key: 'body', value: [] }])).toThrow(/`body`/);
  });

  it('gives a page that still reads cleanly', () => {
    const out = editPage(CARD, [
      { op: 'insert', index: 2, item: { note: { type: 'tip', title: 'New' } } },
      { op: 'set', index: 0, item: 'Changed.\n\nTwo paragraphs.' },
    ]);
    expect(parsePage(out, registry).issues).toEqual([]);
  });
});

describe('pageItem', () => {
  const parsed = parsePage(CARD, registry);
  const items = parsed.blocks.map((node) => {
    const renderer = registry.get(node.name);
    if (!renderer) {
      throw new Error(node.name);
    }
    return pageItem(node, renderer);
  });

  it('writes each block as the page has it, attributes typed as declared', () => {
    expect(items).toEqual([
      { code: 'import { Card } from "x";', lang: 'tsx' },
      { example: 'examples/plain.tsx', mode: 'split', collapse: 6 },
      { note: { type: 'tip', title: 'Keep it short' } },
    ]);
  });

  it('is what editPage takes back without a change', () => {
    const edits = parsed.items.flatMap((item, index) => {
      return item.kind === 'block' ? [{ op: 'set' as const, index, item: items.shift() }] : [];
    });
    expect(edits.map((edit) => edit.index)).toEqual([2, 3, 4]);
    expect(editPage(CARD, edits)).toBe(CARD);
  });

  it("names each item's place in body", () => {
    expect(parsed.items.map((item) => [item.kind, item.index])).toEqual([
      ['prose', 0],
      ['heading', 1],
      ['block', 2],
      ['block', 3],
      ['block', 4],
    ]);
  });

  it("refuses a markdown block written as a list, which it can't write back", () => {
    const nested = parsePage(
      page('title: T', 'body:', '  - aside:', '      - |', '        x'),
      registry,
    );
    const [aside] = nested.blocks;
    expect(() => aside && pageItem(aside, RENDERERS[3] as AnyRenderer)).toThrow(/list of items/);
  });
});
