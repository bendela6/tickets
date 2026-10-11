import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import type { Heading } from '../registry/types';
import { slug, textOf } from './text';

// What a markdown document and a YAML page share: plain markdown parsed to mdast,
// and the headings found in it.

export type MarkdownNodes = ReturnType<typeof fromMarkdown>['children'];

/** Plain markdown, GFM included, as mdast nodes. */
export function markdownNodes(text: string): MarkdownNodes {
  return fromMarkdown(text, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }).children;
}

/** Line endings as `\n`, whatever the checkout wrote. */
export const normalise = (source: string) => source.replace(/\r\n?/g, '\n');

/**
 * The headings in a run of markdown, each with the paragraph after it.
 *
 * mdast numbers every run it parses from 1, so a heading's position means
 * something only against where its run starts. `lineOffset` is the page's
 * line just before the run, so `lineOffset + position.start.line` is the
 * heading's real line.
 */
export function headingsIn(nodes: MarkdownNodes, lineOffset: number): Heading[] {
  return nodes.flatMap((node, index) => {
    if (node.type !== 'heading') {
      return [];
    }
    const text = textOf(node);
    const next = nodes[index + 1];
    return [
      {
        depth: node.depth,
        text,
        id: slug(text),
        line: lineOffset + (node.position?.start.line ?? 1),
        firstParagraph: next?.type === 'paragraph' ? textOf(next) : undefined,
      },
    ];
  });
}
