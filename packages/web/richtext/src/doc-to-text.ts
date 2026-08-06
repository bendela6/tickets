import type { DocNode } from './detect';

// Atom nodes contribute their visible label so search/excerpts still match.
function inlineText(node: DocNode): string {
  const parts: string[] = [];
  let textPart = '';

  for (const child of node.content ?? []) {
    if (child.type === 'mention' || child.type === 'ticketRef') {
      // Atom node: flush text buffer and add atom label as separate part
      if (textPart) {
        parts.push(textPart);
        textPart = '';
      }
      parts.push(String(child.attrs?.['label'] ?? ''));
    } else {
      // Text or other content node: accumulate in text buffer
      if (child.text !== undefined) {
        textPart += child.text;
      } else {
        textPart += inlineText(child);
      }
    }
  }

  if (textPart) {
    parts.push(textPart);
  }

  return parts.join(' ');
}

const BLOCKS = new Set([
  'paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock',
  'callout', 'detailsSummary', 'detailsContent', 'tableRow',
]);

export function docToText(doc: DocNode): string {
  const lines: string[] = [];
  const walk = (node: DocNode) => {
    if (BLOCKS.has(node.type) && (node.content ?? []).every((child) => child.text !== undefined || !BLOCKS.has(child.type))) {
      const text = inlineText(node).trim();
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
