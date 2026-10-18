import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { AnyRenderer, Attribute, Registry } from '../registry/types';
import { HEADING_ITEMS } from './parse-page';

// A YAML page's JSON Schema, from the registry: what an editor reads to offer
// block names and attributes as you type, and to flag a wrong one.

type JsonSchema = Record<string, unknown>;

/** What `pageSchema` takes from the host: the frontmatter's schema, and a JSON Schema converter. */
export interface PageSchemaOptions {
  /**
   * JSON Schema for the frontmatter, as an object schema: its `properties`
   * and `required` become the page's own, beside `body`.
   */
  frontmatter?: { properties?: object; required?: readonly string[] };
  /** Turns a data block's schema into JSON Schema; omitted, it takes any mapping. */
  jsonSchema?: (schema: StandardSchemaV1) => object;
}

const ITEMS = '#/definitions/items';

function attributeSchema(attribute: Attribute | undefined): JsonSchema {
  if (!attribute) {
    return { type: ['string', 'number'] };
  }
  const { description, values, type } = attribute;
  if (values) {
    return { description, enum: [...values] };
  }
  return { description, type: type ?? ['string', 'number'] };
}

function valueSchema(renderer: AnyRenderer, options: PageSchemaOptions): JsonSchema {
  if (renderer.main) {
    return attributeSchema(renderer.attributes?.[renderer.main]);
  }
  if (renderer.body === 'text') {
    return { type: 'string' };
  }
  if (renderer.body === 'markdown') {
    return { anyOf: [{ type: 'string' }, { $ref: ITEMS }] };
  }
  if (renderer.schema && options.jsonSchema) {
    // A schema of its own says which draft it is; this one is a part of the page's.
    const part: JsonSchema = { ...options.jsonSchema(renderer.schema) };
    delete part.$schema;
    return part;
  }
  return { type: 'object' };
}

/** One block as a list item: its name holding its body, and its attributes beside it. */
function blockSchema(renderer: AnyRenderer, options: PageSchemaOptions): JsonSchema {
  const attributes = Object.entries(renderer.attributes ?? {})
    .filter(([name]) => name !== renderer.main)
    .map(([name, attribute]) => [name, attributeSchema(attribute)]);
  return {
    type: 'object',
    description: renderer.description,
    properties: {
      [renderer.name]: { ...valueSchema(renderer, options), description: renderer.description },
      ...Object.fromEntries(attributes),
    },
    required: [renderer.name],
    additionalProperties: false,
  };
}

function headingSchema(name: string, depth: number): JsonSchema {
  return {
    type: 'object',
    properties: {
      [name]: {
        type: ['string', 'number'],
        description: `A level ${depth} heading.${depth === 2 ? ' The page’s rail lists these.' : ''}`,
      },
    },
    required: [name],
    additionalProperties: false,
  };
}

/** The JSON Schema a YAML page is written against, for an editor. */
export function pageSchema(
  registry: Registry,
  options: PageSchemaOptions = {},
): Record<string, unknown> {
  const blocks = registry
    .values()
    .filter((renderer) => !renderer.inline)
    .sort((a, b) => a.name.localeCompare(b.name));
  const { properties = {}, required = [] } = options.frontmatter ?? {};

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      ...properties,
      body: { description: 'The page: prose and blocks, in order.', $ref: ITEMS },
    },
    required: [...required, 'body'],
    additionalProperties: false,
    definitions: {
      items: {
        type: 'array',
        items: {
          anyOf: [
            { $ref: '#/definitions/prose' },
            ...Object.keys(HEADING_ITEMS).map((name) => ({ $ref: `#/definitions/${name}` })),
            ...blocks.map((renderer) => ({ $ref: `#/definitions/block-${renderer.name}` })),
          ],
        },
      },
      prose: {
        type: 'string',
        description: 'Markdown prose. Write it with `|`, the text indented under it.',
      },
      ...Object.fromEntries(
        Object.entries(HEADING_ITEMS).map(([name, depth]) => [name, headingSchema(name, depth)]),
      ),
      ...Object.fromEntries(
        blocks.map((renderer) => [`block-${renderer.name}`, blockSchema(renderer, options)]),
      ),
    },
  };
}
