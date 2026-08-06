import type { DocNode } from './detect';

const KIND_LABEL: Record<string, string> = { info: 'Info', warning: 'Warning', success: 'Success', danger: 'Danger' };

function inline(nodes: DocNode[] | undefined): string {
  return (nodes ?? []).map((node) => {
    if (node.type === 'ticketRef') { return `#${String(node.attrs?.['label'] ?? '')}`; }
    if (node.type === 'mention') { return `@${String(node.attrs?.['label'] ?? '')}`; }
    if (node.type === 'image') { return `![${String(node.attrs?.['alt'] ?? '')}](${String(node.attrs?.['src'] ?? '')})`; }
    if (node.type === 'hardBreak') { return '\n'; }
    let out = node.text ?? '';
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') { out = `**${out}**`; }
      else if (mark.type === 'italic') { out = `_${out}_`; }
      else if (mark.type === 'strike') { out = `~~${out}~~`; }
      else if (mark.type === 'code') { out = `\`${out}\``; }
      else if (mark.type === 'link') { out = `[${out}](${String(mark.attrs?.['href'] ?? '')})`; }
      // underline / highlight / textStyle(color) / textAlign: dropped
    }
    return out;
  }).join('');
}

type Serializer = (node: DocNode) => string;
const paragraphText = (node: DocNode): string => (node.content ?? []).map((c) => inline(c.content)).join('\n');

const BLOCK_SERIALIZERS: Record<string, Serializer> = {
  paragraph: (n) => inline(n.content),
  heading: (n) => `${'#'.repeat(Number(n.attrs?.['level'] ?? 1))} ${inline(n.content)}`,
  codeBlock: (n) => '```\n' + (n.content?.[0]?.text ?? '') + '\n```',
  blockquote: (n) => serializeBlocks(n.content).split('\n').map((l) => `> ${l}`).join('\n'),
  callout: (n) => `> **${KIND_LABEL[String(n.attrs?.['kind'] ?? 'info')] ?? 'Info'}:** ${paragraphText(n)}`,
  details: (n) => {
    const summary = n.content?.find((c) => c.type === 'detailsSummary');
    const body = n.content?.find((c) => c.type === 'detailsContent');
    return [`**${inline(summary?.content)}**`, serializeBlocks(body?.content)].filter(Boolean).join('\n\n');
  },
  bulletList: (n) => (n.content ?? []).map((li) => `- ${paragraphText(li)}`).join('\n'),
  orderedList: (n) => (n.content ?? []).map((li, i) => `${i + 1}. ${paragraphText(li)}`).join('\n'),
  taskList: (n) => (n.content ?? []).map((ti) => `- [${ti.attrs?.['checked'] === true ? 'x' : ' '}] ${paragraphText(ti)}`).join('\n'),
  horizontalRule: () => '---',
  table: (n) => {
    const rows = n.content ?? [];
    const line = (row: DocNode) => `| ${(row.content ?? []).map((cell) => paragraphText(cell)).join(' | ')} |`;
    const [head, ...rest] = rows;
    if (!head) { return ''; }
    const divider = `| ${(head.content ?? []).map(() => '---').join(' | ')} |`;
    return [line(head), divider, ...rest.map(line)].join('\n');
  },
};

export function serializeBlocks(nodes: DocNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => (BLOCK_SERIALIZERS[node.type] ?? paragraphText)(node))
    .filter((s) => s.length > 0)
    .join('\n\n');
}

export function docToMarkdown(doc: DocNode): string {
  return serializeBlocks(doc.content);
}
