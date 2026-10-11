import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { createRegistry } from '../registry/registry';
import type { AnyRenderer, BlockNode } from '../registry/types';
import { parsePage, readPageFrontmatter } from './parse-page';

const component = () => null;

const RENDERERS: AnyRenderer[] = [
  {
    name: 'code',
    body: 'text',
    description: 'Code.',
    attributes: {
      lang: { description: 'The language.' },
      numbers: { description: 'The gutter.', type: 'boolean' },
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
    schema: v.object({
      title: v.string(),
      rows: v.optional(v.array(v.object({ name: v.string() }))),
    }),
    examples: ['x'],
    component,
  },
  {
    name: 'ref',
    body: 'text',
    description: 'A reference.',
    main: 'of',
    attributes: { of: { description: 'What it names.' } },
    examples: ['x'],
    component,
  },
  { name: 'aside', body: 'markdown', description: 'An aside.', examples: ['x'], component },
  {
    name: 'badge',
    body: 'text',
    inline: true,
    description: 'A badge.',
    examples: [':badge[x]'],
    component,
  },
];
const registry = createRegistry(RENDERERS);

const META = v.strictObject({ title: v.string(), summary: v.string() });

const page = (...lines: string[]) => lines.join('\n');

const GOOD = page(
  'title: Card', // 1
  'summary: A box.', // 2
  'body:', // 3
  '  - |', // 4
  '    A card holds **one** thing.', // 5
  '', // 6
  '    ## Inside the prose', // 7
  '  - h2: Usage', // 8
  '  - code: |', // 9
  '      const a = 1;', // 10
  '    lang: ts', // 11
  '    numbers: false', // 12
  '    collapse: 6', // 13
  '  - ref: Card', // 14
  '  - note:', // 15
  '      title: Heads up', // 16
  '  - aside:', // 17
  '      - |', // 18
  '        Inside.', // 19
  '      - ref: Box', // 20
);

describe('parsePage', () => {
  it('parses a page into the tree a markdown page gives', () => {
    const doc = parsePage(GOOD, registry, { frontmatter: META });
    expect(doc.issues).toEqual([]);
    expect(doc.frontmatter).toEqual({ title: 'Card', summary: 'A box.' });
    expect(doc.nodes.map((node) => node.type)).toEqual([
      'paragraph',
      'heading',
      'heading',
      'block',
      'block',
      'block',
      'block',
    ]);
    const [code, ref, note, aside, nested] = doc.blocks as [
      BlockNode,
      BlockNode,
      BlockNode,
      BlockNode,
      BlockNode,
    ];
    expect(code).toMatchObject({
      name: 'code',
      line: 9,
      text: 'const a = 1;\n',
      attrs: { lang: 'ts', numbers: 'false', collapse: '6' },
    });
    expect(ref).toMatchObject({ name: 'ref', line: 14, attrs: { of: 'Card' } });
    expect(note).toMatchObject({ name: 'note', line: 15, data: { title: 'Heads up' } });
    expect(aside.children?.map((node) => node.type)).toEqual(['paragraph', 'block']);
    // A parent comes before the blocks nested in it.
    expect(nested).toMatchObject({ name: 'ref', line: 20, attrs: { of: 'Box' } });
  });

  it('finds headings on their lines, in prose and as items', () => {
    const { headings } = parsePage(GOOD, registry);
    expect(headings.map(({ depth, text, id, line }) => ({ depth, text, id, line }))).toEqual([
      { depth: 2, text: 'Inside the prose', id: 'inside-the-prose', line: 7 },
      { depth: 2, text: 'Usage', id: 'usage', line: 8 },
    ]);
  });

  it('keeps its own items in order, and the line each text starts on', () => {
    const doc = parsePage(GOOD, registry);
    expect(doc.items.map((item) => (item.kind === 'block' ? item.node.name : item.kind))).toEqual([
      'prose',
      'heading',
      'code',
      'ref',
      'note',
      'aside',
    ]);
    // Each item's own nodes, which together are the page's.
    expect(doc.items.flatMap((item) => item.nodes)).toEqual(doc.nodes);
    expect(doc.blocks[0]?.bodyLine).toBe(10);
    const oneLine = parsePage('body:\n  - code: const b = 2;', registry);
    expect(oneLine.blocks[0]).toMatchObject({ line: 2, bodyLine: 2 });
  });

  it('reads Windows line endings the same', () => {
    const doc = parsePage(GOOD.replace(/\n/g, '\r\n'), registry);
    expect(doc.issues).toEqual([]);
    expect(doc.blocks.map((block) => block.line)).toEqual([9, 14, 15, 17, 20]);
  });

  it('reports each problem on its own line', () => {
    const broken = page(
      'title: Card', // 1
      'body:', // 2
      '  - plain prose', // 3
      '  - nope: 1', // 4
      '  - code: x', // 5
      '    colour: red', // 6
      '    numbers: maybe', // 7
      '    mode: wide', // 8
      '  - note:', // 9
      '      title: 3', // 10
      '      rows:', // 11
      '        - name: 1', // 12
      '  - note:', // 13
      '      rows: []', // 14
      '  - code:', // 15
      '      a: b', // 16
      '  - 42', // 17
      '  - h2: Usage', // 18
      '    extra: x', // 19
    );
    const { issues } = parsePage(broken, registry, { frontmatter: META });
    expect(issues.map((issue) => `${issue.line} ${issue.block}: ${issue.message}`)).toEqual([
      expect.stringMatching(/^1 frontmatter: .*summary/i),
      '3 prose: Write prose with `|`, the text indented under it, so it is kept as written',
      '4 nope: No renderer named "nope" is registered',
      '6 code: code has no attribute "colour"; it takes lang, numbers, mode, collapse',
      '7 code: numbers takes one value: true or false',
      '8 code: mode: wide is not one of split, source',
      expect.stringMatching(/^10 note: /),
      expect.stringMatching(/^12 note: /),
      expect.stringMatching(/^14 note: .*title/i),
      '15 code: code takes its text as the value: `- code: |`, the text under it',
      '17 page: An item is prose (`- |`, the text under it) or a block (`- name: …`)',
      '18 h2: A heading is one line: `- h2: …`',
    ]);
  });

  it('says an inline mark is written inside prose, not as an item', () => {
    const { issues } = parsePage(page('body:', '  - badge: stable'), registry);
    expect(issues.map((issue) => `${issue.line} ${issue.block}: ${issue.message}`)).toEqual([
      '2 badge: badge is an inline mark: write it inside prose, as `:badge[…]`',
    ]);
  });

  it('stops at YAML that does not parse, on its line', () => {
    const { issues, nodes } = parsePage(
      page('body:', '  - |', '    text', '   - ref: x'),
      registry,
    );
    expect(nodes).toEqual([]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ block: 'page', line: 4 });
    expect(issues[0]?.message).not.toMatch(/at line/);
  });

  it('says what a page is when it is something else', () => {
    const message = (source: string) => parsePage(source, registry).issues.map((i) => i.message);
    expect(message('- a list')).toEqual([
      'A page is a mapping: its title, summary and the rest, then `body`',
    ]);
    expect(message('title: Card')).toEqual(['A page has a `body`: a list of prose and blocks']);
    expect(message('title: Card\nbody: text')).toEqual([
      '`body` is a list: each item prose or a block',
    ]);
  });
});

describe('readPageFrontmatter', () => {
  it('reads everything but the body, and nothing from a page that does not parse', () => {
    expect(readPageFrontmatter(GOOD)).toEqual({ title: 'Card', summary: 'A box.' });
    expect(readPageFrontmatter('title: [unclosed')).toEqual({});
    expect(readPageFrontmatter('- a list')).toEqual({});
  });
});
