import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { RootContent } from 'mdast';
import type { ComponentType, ReactNode } from 'react';

/** A block's `{…}` attributes: `key=value`, `key="quoted value"`, or a bare flag. */
export type Attrs = Record<string, string | true>;

/** A run of plain markdown between blocks. */
export interface MarkdownSegment {
  kind: 'markdown';
  /** The markdown, as written. */
  text: string;
  /** The line it starts on, from 1. */
  line: number;
}

/** A fence or directive, before its body is parsed. */
export interface BlockSegment {
  kind: 'block';
  /** Written as a fence (```name) or a directive (:::name). */
  syntax: 'fence' | 'directive';
  /** The block's name: its renderer's. */
  name: string;
  /** Its `{…}` attributes, and `lang` for a language written before the name. */
  attrs: Attrs;
  /** What is between its opening and closing lines, unparsed. */
  body: string;
  /** The line it opens on, from 1. */
  line: number;
}

/** What `scanBlocks` splits a source into: runs of markdown, and the blocks between them. */
export type Segment = MarkdownSegment | BlockSegment;

/**
 * A block in a parsed page: its name, its attributes, and its body as its
 * renderer reads it: `data` for a data block, `text` for a text block,
 * `children` for a markdown one.
 */
export interface BlockNode {
  type: 'block';
  /** Its renderer's name. */
  name: string;
  /** Its attributes, each as text, or `true` for a bare flag. */
  attrs: Attrs;
  /** A data block's body, parsed from YAML. */
  data?: unknown;
  /** A text block's body, verbatim; a YAML page's markdown block keeps its text here too. */
  text?: string;
  /** A markdown block's body, parsed: prose and the blocks inside it. */
  children?: Node[];
  /** The line it starts on, from 1. */
  line: number;
  /**
   * The line its text starts on. A fence's starts on the next line; a YAML
   * page's may start on the same one (`- code: import …`).
   */
  bodyLine?: number;
  /** Set when the YAML body failed to parse, so validation does not also report schema errors against the `{}` fallback. */
  parseFailed?: boolean;
}

/**
 * A block, or an mdast node as the markdown parser produced it. Blocks sit
 * only in a page's own list and in a block's markdown body; an mdast node's
 * children are mdast all the way down.
 */
export type Node = BlockNode | RootContent;

/** A heading of the page's own, for an on-this-page list or a search index. */
export interface Heading {
  /** 2 for `##` or `- h2:`, and so on. */
  depth: number;
  /** Its text, marks flattened away. */
  text: string;
  /** Its text slugged: the id the drawn heading takes. */
  id: string;
  /** The line it is on, from 1. */
  line: number;
  /** The text of the paragraph right after it, if one follows. */
  firstParagraph?: string;
}

/** A parsed page: what `DocView` draws. */
export interface Doc {
  /** What the page says about itself: a document's `---` block, or a YAML page's keys but `body`. */
  frontmatter: Record<string, unknown>;
  /** The page's own nodes, in order: markdown, and the blocks between it. */
  nodes: Node[];
  /** The headings in the page's own nodes, not those inside its blocks. */
  headings: Heading[];
  /** Every block, nested ones too, each parent before the blocks inside it. */
  blocks: BlockNode[];
}

/**
 * Whatever the host hands every block as it draws a page: the page's file, a
 * route, a theme. The package reads nothing in it.
 */
export type RenderContext = Record<string, unknown>;

/** The long form of an example: its source, and the prose a gallery shows above it. */
export interface HeadedExample {
  /** The block as a page writes it: a page item (`- name: …`) or markdown. */
  source: string;
  /** What this example demonstrates, as a sentence-case phrase. */
  heading: string;
  /** One line under the heading. Omit when the heading says enough. */
  note?: string;
}

/**
 * One example of a block, as authored.
 *
 * A bare string is the shorthand: the source, with no prose around it. That is
 * all a test fixture or a one-off block needs. The long form adds what a
 * gallery needs to introduce an example. Both forms are normalised by
 * `toExample`, so no consumer handles the union.
 */
export type Example = string | HeadedExample;

/** An example in its long form, the heading and note optional: what `toExample` gives. */
export interface NormalizedExample {
  /** The block as a page writes it. */
  source: string;
  /** What it demonstrates, as a sentence-case phrase. */
  heading?: string;
  /** One line under the heading. */
  note?: string;
}

/** The long form of an example, whichever form it was authored in. */
export function toExample(example: Example): NormalizedExample {
  return typeof example === 'string' ? { source: example } : example;
}

/**
 * One attribute a block takes, as a YAML page checks it and an editor offers
 * it. The component still reads it from `attrs`, as text.
 */
export interface Attribute {
  /** What it does, in a sentence: an editor shows it on hover. */
  description: string;
  /** The values it takes; omitted, any text. */
  values?: readonly string[];
  /** A number or a yes/no rather than text. */
  type?: 'number' | 'boolean';
}

/** What a renderer's component is handed. */
export interface BlockProps<T> {
  /**
   * Its body: a data block's data, checked against the schema; a text
   * block's text; an inline mark's label.
   */
  data: T;
  /** Its attributes, each as text, or `true` for a bare flag. */
  attrs: Attrs;
  /** The page it is drawn in. */
  doc: Doc;
  /** What the host handed `DocView`. */
  ctx: RenderContext;
  /** A markdown block's body, drawn with the page's elements and blocks. */
  children?: ReactNode;
}

/**
 * A block: its name, what its body is, how it is checked, how it is drawn,
 * and how it reads as plain markdown. A registry holds them by name.
 */
export interface Renderer<T = unknown> {
  /** What a page names it by: `- callout:`, ```callout, `:::callout`. Unique in a registry. */
  name: string;
  /**
   * What its body is: YAML data, checked against `schema`; markdown, drawn
   * with the page's own elements and blocks; or text, kept verbatim.
   */
  body: 'data' | 'markdown' | 'text';
  /**
   * Written inside prose as `:name[label]{attrs}` rather than as a block of
   * its own; its component gets the label as `data`.
   */
  inline?: boolean;
  /**
   * Which group it is listed under, as the page editor's add menu lists
   * blocks. Free-form; blocks that name no group are listed together at the end.
   */
  group?: string;
  /** One or two sentences telling an authoring model what the block is and how to write it. */
  description: string;
  /**
   * Checks a data block's body: any Standard Schema, valibot's as it is.
   * Synchronous only; a block whose data fails it draws the error card.
   */
  schema?: StandardSchemaV1<T>;
  /**
   * The attributes it takes. A YAML page allows these and no others, so a
   * block that declares none takes none there; markdown doesn't check them.
   */
  attributes?: Record<string, Attribute>;
  /**
   * The attribute a YAML page's item gives by value, for a block whose body
   * the page doesn't write: `- props: Button` is `of: Button`.
   */
  main?: string;
  /**
   * The block as plain markdown, for a YAML page's markdown copy: what GitHub,
   * an editor's preview and a Claude session read. Omitted, a block is written
   * as a markdown document would write it.
   */
  toMarkdown?: (node: BlockNode) => string;
  /**
   * How a page writes it, at least one: what `toPrompt` teaches a model from,
   * what a block's page shows, and what the page editor starts a new one from.
   */
  examples: Example[];
  /** Draws it, given its body, its attributes, the page and the host's context. */
  component: ComponentType<BlockProps<T>>;
}

/**
 * A renderer of any data shape. A registry holds renderers of different
 * shapes side by side, and `component` takes its data as a parameter, so no
 * narrower type admits them all.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRenderer = Renderer<any>;

/** How `toPrompt` writes the block reference. */
export interface PromptOptions {
  /** Turns a renderer's schema into JSON Schema for the prompt; omitted, no schema is shown. */
  jsonSchema?: (schema: StandardSchemaV1) => unknown;
  /**
   * How a page writes a block: as markdown (fences and directives, the
   * default), or as an item of a YAML page (`page`).
   */
  form?: 'markdown' | 'page';
}

/** What reading a page needs of a registry: its renderers, by name. */
export type RendererLookup = Pick<Registry, 'get' | 'names'>;

/** The blocks a page may use, by name: what `createRegistry` gives. */
export interface Registry {
  /** The renderer of that name, if one is registered. */
  get(name: string): AnyRenderer | undefined;
  /** Every registered name: a fence is a block only when its language is one. */
  names(): ReadonlySet<string>;
  /** Every renderer, in the order registered. */
  all(): readonly AnyRenderer[];
  /** Adds a renderer; throws on a name already taken, no description, or no example. */
  register(renderer: AnyRenderer): void;
  /** The block reference for an authoring model, over every renderer: `toPrompt`. */
  toPrompt(options?: PromptOptions): string;
}

/** Whether a node is a block rather than markdown. */
export function isBlockNode(node: Node): node is BlockNode {
  return node.type === 'block';
}
