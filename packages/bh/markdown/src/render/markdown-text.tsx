import { useMemo } from 'react';
import { markdownNodes } from '../parse/markdown';
import { createRegistry } from '../registry/registry';
import type { Doc } from '../registry/types';
import { DocView } from './doc-view';
import type { MarkdownElements } from './elements';

/** No blocks: a mark with no renderer stays as written. */
const NO_BLOCKS = createRegistry();

/** What `MarkdownText` draws, and with what. */
export interface MarkdownTextProps {
  /** Plain markdown, GFM included: every fence, `:::` and mark in it stays text. */
  source: string;
  /** The host's components for markdown's elements; keep the object stable. */
  elements?: MarkdownElements;
}

/**
 * Plain markdown, GFM included, drawn with the host's elements: no blocks, no
 * frontmatter, no inline marks. For text the app didn't write (an agent's
 * note, a tool's output), where a fence, a `:::` or a `:mark[…]` is only
 * text and never reaches a renderer. Raw HTML draws nothing.
 */
export function MarkdownText({ source, elements }: MarkdownTextProps) {
  const doc = useMemo((): Doc => {
    return { frontmatter: {}, nodes: markdownNodes(source), headings: [], blocks: [] };
  }, [source]);
  return <DocView doc={doc} registry={NO_BLOCKS} elements={elements} />;
}
