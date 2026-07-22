export type DocMark = { type: string; attrs?: Record<string, unknown> };
export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
};

const SENTINEL = '{"type":"doc"';
const ATOMS = new Set(['image', 'mention', 'ticketRef']);

export function isRichDoc(text: string): boolean {
  return parseDoc(text) !== null;
}

export function parseDoc(text: string): DocNode | null {
  if (!text.startsWith(SENTINEL)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && (parsed as DocNode).type === 'doc') {
      return parsed as DocNode;
    }
  } catch {
    // fall through
  }
  return null;
}

export function isDocEmpty(doc: DocNode): boolean {
  const walk = (node: DocNode): boolean => {
    if (node.text !== undefined && node.text.trim().length > 0) {
      return false;
    }
    if (ATOMS.has(node.type)) {
      return false;
    }
    return (node.content ?? []).every(walk);
  };
  return (doc.content ?? []).every(walk);
}
