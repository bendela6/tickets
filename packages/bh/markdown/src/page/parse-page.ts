import type { StandardSchemaV1 } from '@standard-schema/spec';
import {
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parse as parseYaml,
  parseDocument as parseYamlDocument,
  Scalar,
  type ParsedNode,
  type Pair,
  type YAMLMap,
  type YAMLSeq,
} from 'yaml';
import { headingsIn, markdownNodes, normalise } from '../parse/markdown';
import type { ParsedDoc, ParseIssue } from '../parse/parse';
import type { AnyRenderer, BlockNode, Heading, Node, RendererLookup } from '../registry/types';
import { pathOf } from '../schema-path';

// A page written in YAML: its frontmatter at the top level, then `body`, a
// list whose items are prose (a string) or blocks (a mapping named by its
// first key). It parses to the same tree as a markdown document, so DocView
// draws either, and every problem is reported on the page's own line.

/** The headings a page writes as items: `- h2: Props`. Written as `- ## Props`, YAML reads a comment. */
export const HEADING_ITEMS: Readonly<Record<string, number>> = { h2: 2, h3: 3 };

/** What `parsePage` checks beside the blocks. */
export interface PageOptions {
  /** Checks the frontmatter: everything at the top level but `body`. */
  frontmatter?: StandardSchemaV1;
}

/**
 * One of a page's own items, as written, for a writer that walks them in
 * order. `index` is its place in `body`, which an edit names it by;
 * `nodes` are what it draws, for a host that draws the items one by one.
 */
export type PageItem = (
  | { kind: 'prose'; text: string; line: number }
  | { kind: 'heading'; depth: number; text: string; line: number }
  | { kind: 'block'; node: BlockNode }
) & { index: number; nodes: Node[] };

/** A YAML page, parsed: the tree `DocView` draws, its items in order, and its problems. */
export interface ParsedPage extends ParsedDoc {
  /** The body's items, top level only; a nested block is its parent's. */
  items: PageItem[];
  /** The frontmatter as written: the page's YAML without `body`. */
  frontmatterYaml: string;
}

type Yaml = ParsedNode | null | undefined;
type Path = readonly (PropertyKey | StandardSchemaV1.PathSegment)[];

const keyOf = (pair: Pair<unknown, unknown>): string => {
  return isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
};

/**
 * A YAML page's frontmatter alone, without reading its body: what a nav or an
 * index needs from every page up front. A page that doesn't parse has none.
 */
export function readPageFrontmatter(source: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = parseYaml(normalise(source));
  } catch {
    return {};
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {};
  }
  return Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'body'));
}

/**
 * The YAML node a schema path leads to, or the deepest one along it that
 * exists: a missing field is reported where its parent is.
 */
function nodeAlong(start: Yaml, path: Path): Yaml {
  let at = start;
  for (const segment of path) {
    const key = typeof segment === 'object' ? segment.key : segment;
    if (!isMap(at) && !isSeq(at)) {
      break;
    }
    const next = (at as YAMLMap | YAMLSeq).get(key, true) as Yaml;
    if (next === undefined || next === null) {
      break;
    }
    at = next;
  }
  return at;
}

/**
 * Parses a page written in YAML into the tree DocView draws, checking it as
 * it goes: the YAML itself, the shape of each item, each block's attributes
 * against what its renderer declares, each data block against its schema, and
 * the frontmatter against `options.frontmatter`.
 */
export function parsePage(
  source: string,
  registry: RendererLookup,
  options: PageOptions = {},
): ParsedPage {
  const counter = new LineCounter();
  const yaml = parseYamlDocument(normalise(source), { lineCounter: counter });
  const issues: ParseIssue[] = [];
  const blocks: BlockNode[] = [];
  const headings: Heading[] = [];
  const items: PageItem[] = [];
  const empty = (frontmatter: Record<string, unknown>, frontmatterYaml: string): ParsedPage => {
    return { frontmatter, frontmatterYaml, nodes: [], items, headings, blocks, issues };
  };

  const lineOf = (node: unknown): number => {
    const range = (node as { range?: readonly number[] | null } | null | undefined)?.range;
    return range ? counter.linePos(range[0] ?? 0).line : 1;
  };
  const report = (line: number, block: string, message: string, path = '') => {
    issues.push({ block, line, path, message });
  };
  const checkSchema = (schema: StandardSchemaV1, value: unknown, at: Yaml, block: string) => {
    const result = schema['~standard'].validate(value);
    if (result instanceof Promise) {
      report(lineOf(at), block, 'Its schema is async; only synchronous schemas are supported');
      return;
    }
    for (const issue of result.issues ?? []) {
      report(lineOf(nodeAlong(at, issue.path ?? [])), block, issue.message, pathOf(issue));
    }
  };

  for (const error of yaml.errors) {
    // The message ends with " at line N, column M:" and an excerpt; the line
    // is reported on its own.
    const message = error.message.replace(/ at line \d+, column \d+:[\s\S]*$/, '');
    report(error.linePos?.[0]?.line ?? 1, 'page', message);
  }
  const root = yaml.contents;
  if (issues.length > 0 || !isMap(root)) {
    if (issues.length === 0) {
      report(
        lineOf(root),
        'page',
        'A page is a mapping: its title, summary and the rest, then `body`',
      );
    }
    return empty({}, '');
  }

  const head = yaml.clone();
  head.delete('body');
  const frontmatterYaml = String(head);
  const frontmatter: Record<string, unknown> = {};
  let body: Pair<unknown, unknown> | undefined;
  for (const pair of root.items) {
    const key = keyOf(pair);
    if (key === 'body') {
      body = pair;
    } else {
      frontmatter[key] = (pair.value as Yaml)?.toJSON() ?? null;
    }
  }
  if (options.frontmatter) {
    checkSchema(options.frontmatter, frontmatter, root, 'frontmatter');
  }

  const setAttribute = (
    node: BlockNode,
    renderer: AnyRenderer,
    key: string,
    value: unknown,
    line: number,
  ) => {
    const declared = renderer.attributes ?? {};
    const spec = declared[key];
    if (!spec) {
      const known = Object.keys(declared);
      report(
        line,
        node.name,
        known.length > 0
          ? `${node.name} has no attribute "${key}"; it takes ${known.join(', ')}`
          : `${node.name} takes no attributes, so not "${key}"`,
      );
      return;
    }
    if (key in node.attrs) {
      report(line, node.name, `"${key}" is given twice`);
      return;
    }
    const scalar = isScalar(value) ? value.value : undefined;
    const fits =
      spec.type === 'number'
        ? typeof scalar === 'number'
        : spec.type === 'boolean'
          ? typeof scalar === 'boolean'
          : typeof scalar === 'string' || typeof scalar === 'number';
    if (!fits) {
      const kind = spec.type === 'boolean' ? 'true or false' : (spec.type ?? 'text');
      report(line, node.name, `${key} takes one value: ${kind}`);
      return;
    }
    if (spec.values && !spec.values.includes(String(scalar))) {
      report(line, node.name, `${key}: ${String(scalar)} is not one of ${spec.values.join(', ')}`);
      return;
    }
    node.attrs[key] = scalar === true ? true : String(scalar);
  };

  // A top-level item's place in `body`; a nested one has none.
  type At = number | undefined;

  const prose = (item: Scalar, at: At): Node[] => {
    const line = lineOf(item);
    if (item.type !== Scalar.BLOCK_LITERAL) {
      report(
        line,
        'prose',
        'Write prose with `|`, the text indented under it, so it is kept as written',
      );
    }
    // A block scalar's text starts on the line after its `|`.
    const block = item.type === Scalar.BLOCK_LITERAL || item.type === Scalar.BLOCK_FOLDED;
    const nodes = markdownNodes(String(item.value));
    if (at !== undefined) {
      headings.push(...headingsIn(nodes, block ? line : line - 1));
      items.push({ kind: 'prose', index: at, nodes, text: String(item.value), line });
    }
    return nodes;
  };

  const heading = (item: YAMLMap, name: string, depth: number, at: At): Node[] => {
    const [first, ...rest] = item.items;
    const line = lineOf(first?.key);
    if (rest.length > 0) {
      report(line, name, `A heading is one line: \`- ${name}: …\``);
    }
    const text = isScalar(first?.value) ? first.value.value : undefined;
    if (typeof text !== 'string' && typeof text !== 'number') {
      report(line, name, `${name} takes the heading's text`);
      return [];
    }
    const nodes = markdownNodes(`${'#'.repeat(depth)} ${String(text)}`);
    if (at !== undefined) {
      headings.push(...headingsIn(nodes, line - 1));
      items.push({ kind: 'heading', index: at, nodes, depth, text: String(text), line });
    }
    return nodes;
  };

  const block = (item: YAMLMap, at: At): Node[] => {
    const [first, ...rest] = item.items;
    if (!first) {
      return [];
    }
    const name = keyOf(first);
    const depth = HEADING_ITEMS[name];
    if (depth) {
      return heading(item, name, depth, at);
    }
    const line = lineOf(first.key);
    const node: BlockNode = { type: 'block', name, attrs: {}, line };
    // Recorded before its body is read, so a parent precedes the blocks nested in it.
    blocks.push(node);
    if (at !== undefined) {
      items.push({ kind: 'block', index: at, nodes: [node], node });
    }
    const renderer = registry.get(name);
    if (!renderer) {
      report(line, name, `No renderer named "${name}" is registered`);
      return [node];
    }
    if (renderer.inline) {
      report(line, name, `${name} is an inline mark: write it inside prose, as \`:${name}[…]\``);
      return [node];
    }

    const value = first.value as Yaml;
    if (renderer.main) {
      setAttribute(node, renderer, renderer.main, value, line);
    } else if (renderer.body === 'text') {
      if (isScalar(value) && typeof value.value === 'string') {
        node.text = value.value;
        // A block scalar's text starts on the line after its `|`.
        const below = value.type === Scalar.BLOCK_LITERAL || value.type === Scalar.BLOCK_FOLDED;
        node.bodyLine = lineOf(value) + (below ? 1 : 0);
      } else {
        report(
          line,
          name,
          `${name} takes its text as the value: \`- ${name}: |\`, the text under it`,
        );
      }
    } else if (renderer.body === 'markdown') {
      if (isScalar(value) && typeof value.value === 'string') {
        // Kept as written too, for a writer: the tree loses the markdown's own form.
        node.text = value.value;
        node.children = markdownNodes(value.value);
      } else if (isSeq(value)) {
        node.children = list(value, false);
      } else {
        report(line, name, `${name} takes markdown, or a list of prose and blocks`);
      }
    } else {
      node.data = value?.toJSON() ?? {};
      if (renderer.schema) {
        checkSchema(renderer.schema, node.data, value, name);
      }
    }
    for (const pair of rest) {
      setAttribute(node, renderer, keyOf(pair), pair.value, lineOf(pair.key));
    }
    return [node];
  };

  const list = (seq: YAMLSeq, top: boolean): Node[] => {
    return seq.items.flatMap((item, index) => {
      const at = top ? index : undefined;
      if (isScalar(item) && typeof item.value === 'string') {
        return prose(item, at);
      }
      if (isMap(item) && item.items.length > 0) {
        return block(item, at);
      }
      report(
        lineOf(item),
        'page',
        'An item is prose (`- |`, the text under it) or a block (`- name: …`)',
      );
      return [];
    });
  };

  if (!body) {
    report(1, 'page', 'A page has a `body`: a list of prose and blocks');
    return empty(frontmatter, frontmatterYaml);
  }
  if (!isSeq(body.value)) {
    report(lineOf(body.key), 'page', '`body` is a list: each item prose or a block');
    return empty(frontmatter, frontmatterYaml);
  }
  const nodes = list(body.value, true);
  return { frontmatter, frontmatterYaml, nodes, items, headings, blocks, issues };
}
