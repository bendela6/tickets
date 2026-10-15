import type { InlineNode } from './inline-node';

/** A mark on a run of text, as Tiptap's JSON writes it: `bold`, `link` with its `href`. */
export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

/** A node of a document, as Tiptap's JSON writes it. The whole document is `type: 'doc'`. */
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
}

/**
 * How a stored document starts, which tells it from markdown text. A caller
 * that only sniffs (to report a stored document that no longer parses) checks
 * it without parsing.
 */
export const DOC_SENTINEL = '{"type":"doc"';

/** Whether the text is a stored document rather than markdown. */
export function isRichDoc(text: string): boolean {
  return parseDoc(text) !== null;
}

/** The stored document, or null for markdown and for a document that no longer parses. */
export function parseDoc(text: string): DocNode | null {
  if (!text.startsWith(DOC_SENTINEL)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && (parsed as DocNode).type === 'doc') {
      return parsed as DocNode;
    }
  } catch {
    // Not JSON after all: the caller treats it as markdown.
  }
  return null;
}

/** Whether the document holds no text, no image and none of the inline nodes. */
export function isDocEmpty(doc: DocNode, nodes: readonly InlineNode[]): boolean {
  const atoms = new Set(['image', ...nodes.map((node) => node.name)]);
  const walk = (node: DocNode): boolean => {
    if (node.text !== undefined && node.text.trim().length > 0) {
      return false;
    }
    if (atoms.has(node.type)) {
      return false;
    }
    return (node.content ?? []).every(walk);
  };
  return (doc.content ?? []).every(walk);
}
