import type { StandardSchemaV1 } from '@standard-schema/spec';
import { Document, isMap, isScalar, isSeq, Scalar } from 'yaml';
import { printType } from './print-type';
import { exampleItem, takes, writtenAs } from './prompt';
import { toExample, type AnyRenderer, type RendererLookup } from './registry/types';

// A block's own page, from what the block says of itself: the human-facing
// sibling of `toPrompt`. It is a YAML page like any other, so a host reads,
// checks and copies it as it does the pages it has files for.

/** What `toPage` takes from the host: a JSON Schema converter, and its live panel. */
export interface ToPageOptions {
  /** Turns the block's schema into JSON Schema, for its Model; omitted, the page has none. */
  jsonSchema?: (schema: StandardSchemaV1) => unknown;
  /**
   * The block that shows a document beside its result, live. Given, each
   * example is one, a page item in YAML (`lang: yaml`) or else markdown;
   * omitted, each is a `code` item.
   */
  panel?: string;
}

/** `keyboard` → `Keyboard`, `data-table` → `DataTable`: the Model's type name. */
const typeName = (name: string) => {
  return name.replace(/(^|[-_])(\w)/g, (_match, _sep: string, letter: string) => {
    return letter.toUpperCase();
  });
};

/** A description's first sentence: the page's summary. */
const firstSentence = (text: string) => /^.*?[.!?](?=\s|$)/s.exec(text)?.[0] ?? text;

/**
 * The page as a page is written: prose as `|` with its text under it, and any
 * text running over lines the same way, so the YAML reads as the markdown it holds.
 */
function asWritten(doc: Document): string {
  const body = doc.get('body');
  for (const item of isSeq(body) ? body.items : []) {
    if (isScalar(item)) {
      item.type = Scalar.BLOCK_LITERAL;
    }
    for (const pair of isMap(item) ? item.items : []) {
      const value = pair.value;
      if (isScalar(value) && typeof value.value === 'string' && value.value.includes('\n')) {
        value.type = Scalar.BLOCK_LITERAL;
      }
    }
  }
  return doc.toString({ lineWidth: 0 });
}

/** The keys beside the block's own, as a markdown list. */
function attributesProse(renderer: AnyRenderer): string | undefined {
  const entries = Object.entries(renderer.attributes ?? {}).filter(([key]) => {
    return key !== renderer.main;
  });
  if (entries.length === 0) {
    return undefined;
  }
  return entries
    .map(([key, attribute]) => `- \`${key}\`: ${attribute.description}${takes(attribute)}`)
    .join('\n');
}

/**
 * A block's page, as YAML: its description and how a page writes it, its
 * data as a TypeScript type, its attributes, then every example under its
 * heading and note, live in a panel when the host has one.
 */
export function toPage(
  renderer: AnyRenderer,
  lookup: RendererLookup,
  options: ToPageOptions = {},
): string {
  const body: unknown[] = [renderer.description, writtenAs(renderer)];
  if (renderer.schema && options.jsonSchema) {
    const model = printType(`${typeName(renderer.name)}Data`, options.jsonSchema(renderer.schema));
    body.push(
      { h2: 'Model' },
      'Its data, as a TypeScript type; a `?` marks what can be left out.',
      { code: model, lang: 'ts' },
    );
  }
  const attributes = attributesProse(renderer);
  if (attributes) {
    body.push({ h2: 'Attributes' }, `Keys beside it:\n\n${attributes}`);
  }
  body.push({ h2: 'Examples' });
  if (options.panel) {
    body.push('Each is live: edit its source and the result follows.');
  }
  renderer.examples.forEach((authored, index) => {
    const { heading, note, source } = toExample(authored);
    const title = heading ?? `Example ${index + 1}`;
    const item = renderer.inline ? undefined : exampleItem(source, renderer, lookup);
    if (options.panel) {
      // A panel's title is its heading, so the example has no other.
      body.push(...(note ? [note] : []), {
        [options.panel]: item ?? source,
        ...(item ? { lang: 'yaml' } : {}),
        title,
      });
    } else {
      body.push({ h3: title }, ...(note ? [note] : []), {
        code: item ?? source,
        lang: item ? 'yaml' : 'markdown',
      });
    }
  });
  const page = { title: renderer.name, summary: firstSentence(renderer.description), body };
  return asWritten(new Document(page));
}
