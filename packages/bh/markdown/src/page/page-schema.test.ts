import { describe, expect, it } from 'vitest';
import { createRegistry } from '../registry/registry';
import type { AnyRenderer } from '../registry/types';
import { pageSchema } from './page-schema';

const component = () => null;
const base = { description: 'What it is.', examples: ['x'], component };

const registry = createRegistry([
  {
    ...base,
    name: 'code',
    body: 'text',
    attributes: {
      lang: { description: 'The language.' },
      numbers: { description: 'The gutter.', type: 'boolean' },
      mode: { description: 'How it opens.', values: ['split', 'source'] },
    },
  },
  { ...base, name: 'ref', body: 'text', main: 'of', attributes: { of: { description: 'Names.' } } },
  { ...base, name: 'aside', body: 'markdown' },
  { ...base, name: 'note', body: 'data', schema: { '~standard': {} } },
  { ...base, name: 'badge', body: 'text', inline: true },
] as AnyRenderer[]);

interface Schema {
  properties: Record<string, unknown>;
  required: string[];
  definitions: Record<string, { properties?: Record<string, unknown>; [key: string]: unknown }>;
}

describe('pageSchema', () => {
  const schema = pageSchema(registry, {
    frontmatter: {
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
    jsonSchema: () => ({ $schema: 'draft', type: 'object', required: ['title'] }),
  }) as unknown as Schema;

  it('puts the frontmatter beside body, both required', () => {
    expect(Object.keys(schema.properties)).toEqual(['title', 'body']);
    expect(schema.required).toEqual(['title', 'body']);
  });

  it('offers prose, the headings and every block but inline marks, by name', () => {
    expect(schema.definitions.items).toEqual({
      type: 'array',
      items: {
        anyOf: [
          '#/definitions/prose',
          '#/definitions/h2',
          '#/definitions/h3',
          '#/definitions/block-aside',
          '#/definitions/block-code',
          '#/definitions/block-note',
          '#/definitions/block-ref',
        ].map(($ref) => ({ $ref })),
      },
    });
  });

  it('gives each block its value and its attributes, and nothing else', () => {
    const code = schema.definitions['block-code'];
    expect(code).toMatchObject({ required: ['code'], additionalProperties: false });
    expect(code?.properties).toEqual({
      code: { type: 'string', description: 'What it is.' },
      lang: { description: 'The language.', type: ['string', 'number'] },
      numbers: { description: 'The gutter.', type: 'boolean' },
      mode: { description: 'How it opens.', enum: ['split', 'source'] },
    });
  });

  it("writes a value by the block's body: an attribute, markdown, or data", () => {
    const value = (name: string) => schema.definitions[`block-${name}`]?.properties?.[name];
    expect(value('ref')).toEqual({ description: 'What it is.', type: ['string', 'number'] });
    expect(value('aside')).toEqual({
      anyOf: [{ type: 'string' }, { $ref: '#/definitions/items' }],
      description: 'What it is.',
    });
    expect(value('note')).toEqual({
      type: 'object',
      required: ['title'],
      description: 'What it is.',
    });
  });

  it('takes any mapping for data with no converter', () => {
    const plain = pageSchema(registry) as unknown as Schema;
    expect(plain.definitions['block-note']?.properties?.note).toEqual({
      type: 'object',
      description: 'What it is.',
    });
  });
});
