/** The shape `textOf` reads, which every mdast node fits. */
export interface TextNode {
  type: string;
  value?: unknown;
  children?: readonly TextNode[];
}

/** A node's plain text, marks and all flattened away. */
export function textOf(node: TextNode): string {
  if (typeof node.value === 'string') {
    return node.value;
  }
  return (node.children ?? []).map(textOf).join('');
}

/** A heading's id: what the parser lists and the walker puts on the element. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
