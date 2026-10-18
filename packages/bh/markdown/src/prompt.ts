import { stringify } from 'yaml';
import { pageItem } from './page/edit-page';
import { parsePage } from './page/parse-page';
import { parseDocument } from './parse/parse';
import { toExample } from './registry/types';
import type {
  AnyRenderer,
  Attribute,
  BlockNode,
  PromptOptions,
  RendererLookup,
} from './registry/types';

const BODY_LABEL = {
  data: 'YAML',
  markdown: 'markdown',
  text: 'verbatim text',
} as const;

/** A fence long enough to contain the example's own longest fence run. */
function fenceFor(example: string): string {
  const runs = [...example.matchAll(/^`{3,}/gm)].map((match) => match[0].length);
  return '`'.repeat(Math.max(4, ...runs.map((length) => length + 1)));
}

/** A lookup of the renderers given, for reading their examples. */
export function lookupOf(renderers: readonly AnyRenderer[]): RendererLookup {
  const byName = new Map(renderers.map((renderer) => [renderer.name, renderer]));
  return {
    names: [...byName.keys()],
    has: (name) => byName.has(name),
    get: (name) => {
      const renderer = byName.get(name);
      if (renderer === undefined) {
        throw new Error(`No block is registered as "${name}".`);
      }
      return renderer;
    },
  };
}

/** An example's heading line and note, as both forms write them. */
function exampleHead(renderer: AnyRenderer, index: number): string[] {
  const { heading, note } = toExample(renderer.examples[index] ?? '');
  // The heading rides on the label, so an example that has one still
  // reads as a single line to a model scanning for "Example 2".
  const label = renderer.examples.length > 1 ? `Example ${index + 1}` : 'Example';
  return [heading ? `${label} — ${heading}:` : `${label}:`, '', ...(note ? [note, ''] : [])];
}

/**
 * The block reference an authoring model reads before writing a page: each
 * block's name, what its body is, what it is for, and its examples. In the
 * page form (`form: 'page'`) a block is written as an item of a YAML page;
 * otherwise as markdown, each example wrapped in a fence it cannot close.
 */
export function toPrompt(renderers: readonly AnyRenderer[], options: PromptOptions = {}): string {
  const sorted = [...renderers].sort((a, b) => a.name.localeCompare(b.name));
  if (options.form === 'page') {
    return pagePrompt(sorted, options);
  }
  const parts = ['# Custom block reference', ''];

  for (const renderer of sorted) {
    const bodyLine = renderer.inline ? 'Body: inline mark' : `Body: ${BODY_LABEL[renderer.body]}`;
    parts.push(`## ${renderer.name}`, '', renderer.description, '', bodyLine, '');

    if (renderer.schema && options.jsonSchema) {
      const jsonSchema = JSON.stringify(options.jsonSchema(renderer.schema), null, 2);
      parts.push('JSON Schema:', '', '```json', jsonSchema, '```', '');
    }
    renderer.examples.forEach((authored, index) => {
      const { source } = toExample(authored);
      const fence = fenceFor(source);
      parts.push(...exampleHead(renderer, index), `${fence}markdown`, source, fence, '');
    });
  }
  return parts.join('\n');
}

const PAGE_INTRO = [
  '# Block reference for YAML pages',
  '',
  'A page is YAML: what it says about itself at the top level (its `title`, `summary` and',
  'the rest), then `body`, a list of items. Prose is a string written with `|`, its',
  'markdown indented under it. A heading is `- h2: Text` or `- h3: Text`. A block is a',
  'mapping whose first key names it and holds its content; its other keys are its',
  'attributes.',
  '',
  '```yaml',
  'title: Card',
  'summary: A box for related content.',
  'body:',
  '  - |',
  '    A card groups related content and actions.',
  '  - h2: Usage',
  '  - code: <Card>…</Card>',
  '    lang: tsx',
  '```',
  '',
  'The blocks:',
  '',
];

/** How a block is written as a page item. */
export function writtenAs(renderer: AnyRenderer): string {
  const name = renderer.name;
  if (renderer.inline) {
    return `Written inside prose, as \`:${name}[…]\`, not as an item of its own.`;
  }
  if (renderer.main) {
    return `Written as \`- ${name}: <${renderer.main}>\`, its \`${renderer.main}\` as the value.`;
  }
  if (renderer.body === 'data') {
    return `Written as \`- ${name}:\` with its data under it, in YAML.`;
  }
  if (renderer.body === 'text') {
    return `Written as \`- ${name}: |\` with its text indented under it (one line can follow the colon).`;
  }
  return `Written as \`- ${name}: |\` with markdown under it, or with a list of prose and blocks.`;
}

/** What an attribute takes, in words. */
export function takes(attribute: Attribute): string {
  if (attribute.values) {
    return ` One of: ${attribute.values.join(', ')}.`;
  }
  if (attribute.type === 'number') {
    return ' A number.';
  }
  return attribute.type === 'boolean' ? ' true or false.' : '';
}

/** The keys beside the block's own: every attribute but the one it is written with. */
function attributeLines(renderer: AnyRenderer): string[] {
  const entries = Object.entries(renderer.attributes ?? {}).filter(([key]) => {
    return key !== renderer.main;
  });
  if (entries.length === 0) {
    return [];
  }
  return [
    'Attributes, as keys beside it:',
    '',
    ...entries.map(
      ([key, attribute]) => `- \`${key}\`: ${attribute.description}${takes(attribute)}`,
    ),
    '',
  ];
}

/**
 * An example as a page item, read from either form it may be authored in: a
 * page item (`- name: …`) or markdown. Undefined when it can't be written as
 * one, as for a markdown body given as a list of items.
 */
export function exampleItem(
  source: string,
  renderer: AnyRenderer,
  lookup: RendererLookup,
): string | undefined {
  const doc = source.trimStart().startsWith('- ')
    ? parsePage(`body:\n${source.replace(/^/gm, '  ')}\n`, lookup)
    : parseDocument(source, lookup);
  const node: BlockNode | undefined = doc.blocks.find((block) => block.name === renderer.name);
  if (!node) {
    return undefined;
  }
  try {
    return stringify([pageItem(node, renderer)], { lineWidth: 0 }).trimEnd();
  } catch {
    return undefined;
  }
}

function pagePrompt(renderers: readonly AnyRenderer[], options: PromptOptions): string {
  const lookup = lookupOf(renderers);
  const parts = [...PAGE_INTRO];
  for (const renderer of renderers) {
    parts.push(`## ${renderer.name}`, '', renderer.description, '', writtenAs(renderer), '');
    parts.push(...attributeLines(renderer));
    if (renderer.schema && options.jsonSchema) {
      const jsonSchema = JSON.stringify(options.jsonSchema(renderer.schema), null, 2);
      parts.push('Its data, as JSON Schema:', '', '```json', jsonSchema, '```', '');
    }
    renderer.examples.forEach((authored, index) => {
      const { source } = toExample(authored);
      const item = renderer.inline ? undefined : exampleItem(source, renderer, lookup);
      const shown = item ?? source;
      const fence = fenceFor(shown);
      const language = item === undefined ? 'markdown' : 'yaml';
      parts.push(...exampleHead(renderer, index), `${fence}${language}`, shown, fence, '');
    });
  }
  return parts.join('\n');
}
