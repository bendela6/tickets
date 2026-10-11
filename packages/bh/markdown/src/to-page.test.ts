import type { StandardSchemaV1 } from '@standard-schema/spec';
import { describe, expect, it } from 'vitest';
import { parsePage } from './page/parse-page';
import { createRegistry } from './registry/registry';
import type { AnyRenderer } from './registry/types';
import { toPage } from './to-page';

const component = () => null;

/** A schema that takes anything: the page's shape is what is under test. */
const anything: StandardSchemaV1 = {
  '~standard': { version: 1, vendor: 'test', validate: (value) => ({ value }) },
};

const note: AnyRenderer = {
  name: 'note',
  body: 'data',
  description: 'A note. It says one thing.',
  schema: anything,
  attributes: { tone: { description: 'How loud.', values: ['soft', 'loud'] } },
  examples: [
    { heading: 'A soft one', note: 'Soft is the default.', source: '```note\ntitle: Hi\n```' },
    '```note\ntitle: Bye\n```',
  ],
  component,
};

const tag: AnyRenderer = {
  name: 'tag',
  body: 'text',
  inline: true,
  description: 'A tag in a sentence.',
  examples: ['It is :tag[new].'],
  component,
};

const registry = createRegistry([
  note,
  tag,
  {
    name: 'panel',
    body: 'text',
    description: 'Live.',
    attributes: { lang: { description: 'Its language.' }, title: { description: 'Its title.' } },
    examples: ['x'],
    component,
  },
  {
    name: 'code',
    body: 'text',
    description: 'Code.',
    attributes: { lang: { description: 'Its language.' } },
    examples: ['x'],
    component,
  },
] as AnyRenderer[]);

const jsonSchema = () => {
  return {
    type: 'object',
    properties: { title: { type: 'string', description: 'Shown first.' } },
    required: ['title'],
  };
};

describe('toPage', () => {
  it('writes a page that reads cleanly: the description, the model, the attributes, the examples', () => {
    const page = parsePage(toPage(note, registry, { jsonSchema, panel: 'panel' }), registry);
    expect(page.issues).toEqual([]);
    expect(page.frontmatter).toEqual({ title: 'note', summary: 'A note.' });
    // An example in a panel is headed by the panel's title, so has no heading of its own.
    expect(page.headings.map((heading) => heading.text)).toEqual([
      'Model',
      'Attributes',
      'Examples',
    ]);
    const [model] = page.blocks.filter((block) => block.name === 'code');
    expect(model?.text).toBe(
      ['type NoteData = {', '  /** Shown first. */', '  title: string;', '};'].join('\n'),
    );
    expect(model?.attrs.lang).toBe('ts');
  });

  it('shows each example live in the panel, as the page item a page writes', () => {
    const page = parsePage(toPage(note, registry, { panel: 'panel' }), registry);
    const panels = page.blocks.filter((block) => block.name === 'panel');
    expect(panels.map((panel) => [panel.text, panel.attrs])).toEqual([
      ['- note:\n    title: Hi', { lang: 'yaml', title: 'A soft one' }],
      ['- note:\n    title: Bye', { lang: 'yaml', title: 'Example 2' }],
    ]);
    expect(
      page.items.some((item) => item.kind === 'prose' && item.text.startsWith('Soft is')),
    ).toBe(true);
  });

  it("shows an inline mark's example as markdown, and every example as code with no panel", () => {
    const live = parsePage(toPage(tag, registry, { panel: 'panel' }), registry);
    expect(live.blocks.find((block) => block.name === 'panel')).toMatchObject({
      text: 'It is :tag[new].',
      attrs: { title: 'Example 1' },
    });
    const still = parsePage(toPage(note, registry), registry);
    expect(
      still.blocks.filter((block) => block.name === 'code').map((block) => block.attrs.lang),
    ).toEqual(['yaml', 'yaml']);
    expect(still.headings.map((heading) => heading.text)).toEqual([
      'Attributes',
      'Examples',
      'A soft one',
      'Example 2',
    ]);
  });
});
