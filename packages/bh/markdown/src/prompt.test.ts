import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { scanBlocks } from './parse/scanner';
import { createRegistry } from './registry/registry';
import type { Renderer } from './registry/types';

const erd: Renderer<{ title: string }> = {
  name: 'erd',
  body: 'data',
  description: 'An entity relationship diagram.',
  schema: v.object({ title: v.string() }),
  examples: ['```erd\ntitle: Core\n```'],
  component: () => null,
};

const stub = (name: string, body: Renderer['body']): Renderer => {
  return {
    name,
    body,
    description: `A ${body}-bodied renderer used to check its label.`,
    examples: ['x'],
    component: () => null,
  };
};

describe('registry.toPrompt', () => {
  it('includes the name, body mode, description, and example', () => {
    const out = createRegistry([erd]).toPrompt();
    expect(out).toContain('## erd');
    expect(out).toContain('An entity relationship diagram.');
    expect(out).toContain('Body: YAML');
    expect(out).toContain('title: Core');
  });

  it('omits the schema section when no converter is given', () => {
    expect(createRegistry([erd]).toPrompt()).not.toContain('JSON Schema');
  });

  it('includes what the converter makes of the schema when one is given', () => {
    const out = createRegistry([erd]).toPrompt({
      jsonSchema: (schema) => {
        expect(schema).toBe(erd.schema);
        return { type: 'object', properties: { title: { type: 'string' } } };
      },
    });
    expect(out).toContain('JSON Schema');
    expect(out).toContain('"title"');
  });

  it('emits each example intact inside a wrapper the example cannot terminate', () => {
    const out = createRegistry([erd]).toPrompt();
    const wrapped = /^(`{3,})markdown\n([\s\S]*?)\n\1\n/m.exec(out);
    expect(wrapped?.[2]).toBe(erd.examples[0]);
  });

  it('sizes the wrapper past a fence contained in the example', () => {
    const nested: Renderer = {
      name: 'nested',
      body: 'text',
      description: 'A renderer whose example itself contains a four-backtick fence.',
      examples: ['````markdown\n```ts\nconst a = 1;\n```\n````'],
      component: () => null,
    };
    const out = createRegistry([nested]).toPrompt();
    expect(out).toContain('`````markdown');
    // Every wrapper's info string is "markdown", so scanning with that name
    // registered reads the wrapper back as a block. Too short a wrapper would
    // close on one of the example's own fences and cut its body short.
    const blocks = scanBlocks(out, new Set(['markdown'])).filter((segment) => {
      return segment.kind === 'block';
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ body: nested.examples[0] });
  });

  it('labels the body mode for each of the three modes', () => {
    const out = createRegistry([
      stub('a', 'data'),
      stub('b', 'markdown'),
      stub('c', 'text'),
    ]).toPrompt();
    expect(out).toContain('Body: YAML');
    expect(out).toContain('Body: markdown');
    expect(out).toContain('Body: verbatim text');
  });

  it('labels an inline renderer as an inline mark rather than only its body mode', () => {
    const badge: Renderer<string> = {
      name: 'badge',
      body: 'text',
      inline: true,
      description: 'An inline badge for use inside a sentence or heading.',
      examples: ['Release :badge[stable]{color=green} today.'],
      component: () => null,
    };
    const out = createRegistry([badge]).toPrompt();
    expect(out).toContain('Body: inline mark');
    expect(out).not.toContain('Body: verbatim text');
  });

  it('numbers examples only when a renderer has more than one', () => {
    const two: Renderer = {
      name: 'two',
      body: 'text',
      description: 'A renderer carrying two worked examples.',
      examples: ['first', 'second'],
      component: () => null,
    };
    const out = createRegistry([two]).toPrompt();
    expect(out).toContain('Example 1:');
    expect(out).toContain('Example 2:');
    expect(createRegistry([erd]).toPrompt()).toContain('\nExample:\n');
  });

  it('puts a heading on the label and its note beneath', () => {
    const headed: Renderer = {
      name: 'headed',
      body: 'text',
      description: 'A renderer whose example carries a heading and a note.',
      examples: [{ source: 'x', heading: 'The short form', note: 'Enough for most pages.' }],
      component: () => null,
    };
    const out = createRegistry([headed]).toPrompt();
    expect(out).toContain('Example — The short form:\n\nEnough for most pages.\n');
  });
});

describe('registry.toPrompt, in the page form', () => {
  const ref: Renderer = {
    name: 'ref',
    body: 'data',
    description: 'A link to another page.',
    main: 'of',
    attributes: {
      of: { description: 'The page it links to.' },
      tone: { description: 'Its colour.', values: ['quiet', 'loud'] },
      size: { description: 'Its size.', type: 'number' },
      open: { description: 'Whether it opens expanded.', type: 'boolean' },
    },
    examples: ['- ref: Card\n  tone: quiet'],
    component: () => null,
  };
  const code: Renderer = {
    name: 'code',
    body: 'text',
    description: 'Code, verbatim.',
    attributes: { lang: { description: 'The grammar.' } },
    examples: ['```code{lang=ts}\nconst a = 1;\n```'],
    component: () => null,
  };

  it('opens with how a page is written', () => {
    const out = createRegistry([erd]).toPrompt({ form: 'page' });
    expect(out).toMatch(/^# Block reference for YAML pages\n/);
    expect(out).toContain('body:\n  - |\n');
  });

  it('writes each example as a page item, from markdown or YAML', () => {
    const out = createRegistry([erd, ref, code]).toPrompt({ form: 'page' });
    expect(out).toContain('```yaml\n- erd:\n    title: Core\n```');
    expect(out).toContain('```yaml\n- ref: Card\n  tone: quiet\n```');
    expect(out).toContain('```yaml\n- code: const a = 1;\n  lang: ts\n```');
    expect(out).not.toContain('```markdown');
  });

  it('says how each block is written, and the attributes beside it', () => {
    const out = createRegistry([erd, ref, code]).toPrompt({ form: 'page' });
    expect(out).toContain('Written as `- erd:` with its data under it, in YAML.');
    expect(out).toContain('Written as `- ref: <of>`, its `of` as the value.');
    expect(out).toContain('Written as `- code: |` with its text indented under it');
    expect(out).toContain('- `tone`: Its colour. One of: quiet, loud.');
    expect(out).toContain('- `size`: Its size. A number.');
    expect(out).toContain('- `open`: Whether it opens expanded. true or false.');
    expect(out).not.toContain('- `of`:');
  });

  it('shows an example it cannot write as an item as it was authored', () => {
    const badge: Renderer<string> = {
      name: 'badge',
      body: 'text',
      inline: true,
      description: 'An inline badge.',
      examples: ['Release :badge[stable] today.'],
      component: () => null,
    };
    const out = createRegistry([badge]).toPrompt({ form: 'page' });
    expect(out).toContain('Written inside prose, as `:badge[…]`');
    expect(out).toContain('````markdown\nRelease :badge[stable] today.\n````');
  });
});
