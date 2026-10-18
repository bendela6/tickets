import { parse as parseYaml } from 'yaml';
import type { BlockNode, Doc, Heading, Node, RendererLookup } from '../registry/types';
import { headingsIn, markdownNodes, normalise } from './markdown';
import { scanBlocks } from './scanner';

/** A problem found while parsing, against the source line it came from. */
export interface ParseIssue {
  /** What it is about: a block's name, or `page`, `prose`, `frontmatter`, `h2`. */
  block: string;
  /** The source line it is on, from 1. */
  line: number;
  /** The schema path, dotted; empty when nothing parsed. */
  path: string;
  /** What is wrong, in a sentence. */
  message: string;
}

/** A parsed page, and what reading it found wrong. */
export interface ParsedDoc extends Doc {
  /** Every problem, each on its line; none for a page that reads cleanly. */
  issues: ParseIssue[];
}

function splitFrontmatter(source: string): [Record<string, unknown>, string, number] {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  if (!match) {
    return [{}, source, 0];
  }
  const [whole, yaml = ''] = match;
  const data = (parseYaml(yaml) ?? {}) as Record<string, unknown>;
  return [data, source.slice(whole.length), whole.split('\n').length - 1];
}

/**
 * A page's frontmatter alone, without parsing the page: what a nav or an
 * index needs from every page up front.
 */
export function readFrontmatter(source: string): Record<string, unknown> {
  return splitFrontmatter(normalise(source))[0];
}

/** The `yaml` package's syntax error, as far as this file reads it. */
interface YamlError {
  message: string;
  linePos?: readonly { line: number }[];
}

/**
 * Parses a page: its frontmatter, its markdown and blocks as one tree, a flat
 * index of every block (parents before the blocks nested in them), its
 * headings, and any YAML body that failed to parse.
 */
export function parseDocument(source: string, registry: RendererLookup): ParsedDoc {
  const [frontmatter, rest, offset] = splitFrontmatter(normalise(source));
  const issues: ParseIssue[] = [];
  const blocks: BlockNode[] = [];
  const headings: Heading[] = [];

  const readData = (node: BlockNode, body: string) => {
    try {
      node.data = parseYaml(body) ?? {};
    } catch (caught) {
      const error = caught as YamlError;
      issues.push({
        block: node.name,
        line: node.line + (error.linePos?.[0]?.line ?? 1),
        // Nothing parsed, so there is no schema path.
        path: '',
        // The message ends with " at line N, column M:" and a caret excerpt,
        // both counted from the block's body, while `line` above counts from
        // the document. Left in, a repair pass reads two line numbers for one
        // issue; stripped, the description stands on its own.
        message: error.message.replace(/ at line \d+, column \d+:[\s\S]*$/, ''),
      });
      node.data = {};
      node.parseFailed = true;
    }
  };

  const names = new Set(registry.names);
  const build = (text: string, base: number, top: boolean): Node[] => {
    const out: Node[] = [];
    for (const segment of scanBlocks(text, names)) {
      const line = base + segment.line;
      if (segment.kind === 'markdown') {
        const nodes = markdownNodes(segment.text);
        if (top) {
          // The segment starts on `line`, so the line before it is the offset.
          headings.push(...headingsIn(nodes, line - 1));
        }
        out.push(...nodes);
        continue;
      }
      const renderer = registry.has(segment.name) ? registry.get(segment.name) : undefined;
      const node: BlockNode = { type: 'block', name: segment.name, attrs: segment.attrs, line };
      // Recorded before its body is read, so a parent always precedes the
      // blocks nested in it in the flat index.
      blocks.push(node);
      out.push(node);
      if (renderer?.body === 'text') {
        node.text = segment.body;
      } else if (renderer?.body === 'markdown') {
        node.children = build(segment.body, line, false);
      } else if (renderer) {
        readData(node, segment.body);
      }
    }
    return out;
  };

  const nodes = build(rest, offset, true);

  return { frontmatter, nodes, headings, blocks, issues };
}
