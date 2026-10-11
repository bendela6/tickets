import { describe, expect, it } from 'vitest';
import { createRegistry } from '../registry/registry';
import type { AnyRenderer } from '../registry/types';
import { pageLinks } from './page-links';
import { fenced, pageMarkdown } from './page-markdown';
import { parsePage } from './parse-page';

const component = () => null;
const base = { description: 'What it is.', examples: ['x'], component };

const registry = createRegistry([
  {
    ...base,
    name: 'shout',
    body: 'text',
    toMarkdown: (node) => `**${(node.text ?? '').trim().toUpperCase()}**`,
  },
  {
    ...base,
    name: 'code',
    body: 'text',
    attributes: { lang: { description: 'The language.' } },
  },
  { ...base, name: 'note', body: 'data' },
  { ...base, name: 'aside', body: 'markdown' },
] as AnyRenderer[]);

const PAGE = [
  '# the page',
  'title: Card',
  "summary: 'A box: one thing.'",
  'body:',
  '  - |',
  '    A card holds **one** thing.',
  '  - h2: Usage',
  '  - code: |',
  '      const a = 1;',
  '    lang: ts',
  '  - shout: careful',
  '  - note:',
  '      title: Heads up',
  '  - aside: Off to one side.',
].join('\n');

describe('pageMarkdown', () => {
  it('writes the frontmatter, a note, the title, then every item in order', () => {
    const page = parsePage(PAGE, registry);
    expect(pageMarkdown(page, registry, { title: 'Card', note: "made by 'sync'" })).toBe(
      [
        '---',
        '# the page',
        'title: Card',
        "summary: 'A box: one thing.'",
        '---',
        '',
        "[//]: # 'made by ’sync’'",
        '',
        '# Card',
        '',
        'A card holds **one** thing.',
        '',
        '## Usage',
        '',
        '```ts',
        'const a = 1;',
        '```',
        '',
        '**CAREFUL**',
        '',
        '```note',
        'title: Heads up',
        '```',
        '',
        'Off to one side.',
        '',
      ].join('\n'),
    );
  });

  it('leaves out what a page without frontmatter or options has none of', () => {
    const page = parsePage('body:\n  - |\n    Just this.', registry);
    expect(pageMarkdown(page, registry)).toBe('Just this.\n');
  });

  it('writes an inline mark as its renderer does, in prose and headings, but not in code', () => {
    const marks = createRegistry([
      {
        ...base,
        name: 'tag',
        body: 'text',
        inline: true,
        toMarkdown: (node) => `*${node.text ?? ''}* (${String(node.attrs.tone)})`,
      },
      { ...base, name: 'plain', body: 'text', inline: true },
    ] as AnyRenderer[]);
    const page = parsePage(
      [
        'body:',
        '  - h2: "Jobs :tag[stable]{tone=success}"',
        '  - |',
        '    Is :tag[beta]{tone=warning}, written `:tag[as code]`, and :plain[kept].',
      ].join('\n'),
      marks,
    );
    expect(pageMarkdown(page, marks)).toBe(
      [
        '## Jobs *stable* (success)',
        '',
        'Is *beta* (warning), written `:tag[as code]`, and :plain[kept].',
        '',
      ].join('\n'),
    );
  });

  it('leads each link outside code where `link` says, in prose, headings and blocks', () => {
    const page = parsePage(
      [
        'body:',
        '  - h2: See [Menu](/menu)',
        '  - |',
        '    Opens [a menu](/menu#items "Menu"), not [this](https://x.dev) or `[code](/menu)`.',
        '',
        '    ````md',
        '    ```',
        '    [fenced](/menu)',
        '    ```',
        '    ````',
        '',
        '    [menu]: /menu',
        '  - aside: Beside [the menu](/menu).',
      ].join('\n'),
      registry,
    );
    const link = (href: string) => {
      return href.startsWith('/menu') ? href.replace('/menu', '../menu/menu.md') : undefined;
    };
    expect(pageMarkdown(page, registry, { link })).toBe(
      [
        '## See [Menu](../menu/menu.md)',
        '',
        'Opens [a menu](../menu/menu.md#items "Menu"), not [this](https://x.dev) or `[code](/menu)`.',
        '',
        '````md',
        '```',
        '[fenced](/menu)',
        '```',
        '````',
        '',
        '[menu]: ../menu/menu.md',
        '',
        'Beside [the menu](../menu/menu.md).',
        '',
      ].join('\n'),
    );
  });
});

describe('pageLinks', () => {
  it('lists every link a page writes, each on its line, and none shown as code', () => {
    const page = parsePage(
      [
        'body:', // 1
        '  - h2: See [Menu](/menu)', // 2
        '  - |', // 3
        '    One [link](#usage).', // 4
        '', // 5
        '    Then `[code](/no)` and [another](/menu#items).', // 6
        '  - note:', // 7
        '      content: In [data](/data).', // 8
        '  - aside:', // 9
        '      - |', // 10
        '        In [an aside](/aside).', // 11
      ].join('\n'),
      registry,
    );
    expect(pageLinks(page)).toEqual([
      { href: '/menu', text: 'Menu', line: 2 },
      { href: '#usage', text: 'link', line: 4 },
      { href: '/menu#items', text: 'another', line: 6 },
      { href: '/data', text: 'data', line: 7 },
      { href: '/aside', text: 'an aside', line: 9 },
    ]);
  });
});

describe('fenced', () => {
  it('outlasts any fence inside the code', () => {
    expect(fenced('md', '````ts\nx\n````\n')).toBe('`````md\n````ts\nx\n````\n`````');
    expect(fenced('', 'x')).toBe('```\nx\n```');
  });
});
