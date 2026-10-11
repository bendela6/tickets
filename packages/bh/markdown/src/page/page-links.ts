import { markdownNodes } from '../parse/markdown';
import { textOf } from '../parse/text';
import type { BlockNode, Node } from '../registry/types';
import type { ParsedPage } from './parse-page';

// Every link a page writes, for a host to check: the engine knows where each
// one is, not where it should lead.

/** A link as a page writes it, on the page's line. */
export interface PageLink {
  /** Its destination as written: `/components/primitives/button#props`, `#usage`, `https://…`. */
  href: string;
  /** What it reads as; empty for a definition (`[name]: /path`). */
  text: string;
  line: number;
}

interface Found {
  href: string;
  text: string;
  /** Its line within the markdown run it was found in, from 1. */
  line: number;
}

/** The links and definitions in a run of markdown, images aside. */
function linksIn(nodes: readonly Node[]): Found[] {
  return nodes.flatMap((node) => {
    if (node.type === 'block') {
      return [];
    }
    const line = node.position?.start.line ?? 1;
    if (node.type === 'link') {
      return [{ href: node.url, text: textOf(node), line }];
    }
    if (node.type === 'definition') {
      return [{ href: node.url, text: '', line }];
    }
    return 'children' in node ? linksIn(node.children) : [];
  });
}

/** The strings in a block's data that could hold a link. */
function linkedStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.includes('](') || value.includes(']:') ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(linkedStrings);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(linkedStrings);
  }
  return [];
}

/**
 * A block's links, each on the block's own line: its markdown body (nested
 * prose included), and markdown in its data's strings (a callout's
 * `content`). Its nested blocks' links are their own.
 */
function blockLinks(block: BlockNode): PageLink[] {
  const found = [
    ...linksIn(block.children ?? []),
    ...linkedStrings(block.data).flatMap((text) => linksIn(markdownNodes(text))),
  ];
  const nested = (block.children ?? []).filter((child) => child.type === 'block');
  return [
    ...found.map(({ href, text }) => ({ href, text, line: block.line })),
    ...nested.flatMap(blockLinks),
  ];
}

/**
 * Every link a page writes: in its prose and headings, each on its own line,
 * and in its blocks, on the block's line. Images aren't links.
 */
export function pageLinks(page: ParsedPage): PageLink[] {
  return page.items.flatMap((item) => {
    if (item.kind === 'block') {
      return blockLinks(item.node);
    }
    // A prose item's text starts on the line after its `|`; a heading is its own line.
    return linksIn(item.nodes).map(({ href, text, line }) => {
      return { href, text, line: item.kind === 'prose' ? item.line + line : item.line };
    });
  });
}
