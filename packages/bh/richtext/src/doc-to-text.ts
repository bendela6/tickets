import type { DocNode } from './detect';
import { nodeText, specOf, type InlineNode } from './inline-node';

/** A block's inline content as text; an inline node gives its words, set apart by spaces. */
function inlineText(node: DocNode, nodes: readonly InlineNode[]): string {
  const parts: string[] = [];
  let run = '';
  for (const child of node.content ?? []) {
    const spec = specOf(nodes, child);
    if (spec) {
      if (run) {
        parts.push(run);
        run = '';
      }
      parts.push(nodeText(spec, child));
    } else {
      run += child.text ?? inlineText(child, nodes);
    }
  }
  if (run) {
    parts.push(run);
  }
  return parts.join(' ');
}

const BLOCKS = new Set([
  'paragraph',
  'heading',
  'listItem',
  'taskItem',
  'blockquote',
  'codeBlock',
  'callout',
  'detailsSummary',
  'detailsContent',
  'tableRow',
]);

/**
 * A document's plain text, one line per block, for search and excerpts. An
 * inline node gives the words it stands for, a mention its name.
 */
export function docToText(doc: DocNode, nodes: readonly InlineNode[]): string {
  const lines: string[] = [];
  const walk = (node: DocNode) => {
    const leaf = (node.content ?? []).every((child) => {
      return child.text !== undefined || !BLOCKS.has(child.type);
    });
    if (BLOCKS.has(node.type) && leaf) {
      const text = inlineText(node, nodes).trim();
      if (text.length > 0) {
        lines.push(text);
      }
      return;
    }
    for (const child of node.content ?? []) {
      walk(child);
    }
  };
  walk(doc);
  return lines.join('\n');
}
