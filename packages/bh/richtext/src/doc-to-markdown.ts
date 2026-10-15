import type { DocNode } from './detect';
import { nodeText, specOf, type InlineNode } from './inline-node';

const KIND_LABEL: Record<string, string> = {
  info: 'Info',
  warning: 'Warning',
  success: 'Success',
  danger: 'Danger',
};

/** Writes a run of inline nodes, or of blocks; each block's writer is handed one. */
interface Writer {
  inline: (content: DocNode[] | undefined) => string;
  blocks: (content: DocNode[] | undefined) => string;
}

type Serializer = (node: DocNode, write: Writer) => string;

/** A block of paragraphs (a list item, a cell, a callout), one line each. */
const paragraphText: Serializer = (node, write) => {
  return (node.content ?? []).map((child) => write.inline(child.content)).join('\n');
};

const BLOCK_SERIALIZERS: Record<string, Serializer> = {
  paragraph: (n, write) => write.inline(n.content),
  heading: (n, write) => {
    return `${'#'.repeat(Number(n.attrs?.['level'] ?? 1))} ${write.inline(n.content)}`;
  },
  codeBlock: (n) => '```\n' + (n.content?.[0]?.text ?? '') + '\n```',
  blockquote: (n, write) => {
    return write
      .blocks(n.content)
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  },
  // Markdown has no callout or details: they become a quote with the kind, and a bold summary.
  callout: (n, write) => {
    const kind = KIND_LABEL[String(n.attrs?.['kind'] ?? 'info')] ?? 'Info';
    return `> **${kind}:** ${paragraphText(n, write)}`;
  },
  details: (n, write) => {
    const summary = n.content?.find((child) => child.type === 'detailsSummary');
    const body = n.content?.find((child) => child.type === 'detailsContent');
    return [`**${write.inline(summary?.content)}**`, write.blocks(body?.content)]
      .filter(Boolean)
      .join('\n\n');
  },
  bulletList: (n, write) => {
    return (n.content ?? []).map((item) => `- ${paragraphText(item, write)}`).join('\n');
  },
  orderedList: (n, write) => {
    return (n.content ?? []).map((item, i) => `${i + 1}. ${paragraphText(item, write)}`).join('\n');
  },
  taskList: (n, write) => {
    return (n.content ?? [])
      .map((item) => {
        return `- [${item.attrs?.['checked'] === true ? 'x' : ' '}] ${paragraphText(item, write)}`;
      })
      .join('\n');
  },
  horizontalRule: () => '---',
  table: (n, write) => {
    const [head, ...rest] = n.content ?? [];
    if (!head) {
      return '';
    }
    const line = (row: DocNode) => {
      return `| ${(row.content ?? []).map((cell) => paragraphText(cell, write)).join(' | ')} |`;
    };
    const divider = `| ${(head.content ?? []).map(() => '---').join(' | ')} |`;
    return [line(head), divider, ...rest.map(line)].join('\n');
  },
};

function inlineMarkdown(node: DocNode, nodes: readonly InlineNode[]): string {
  const spec = specOf(nodes, node);
  if (spec) {
    return spec.markdown ? spec.markdown.serialize(node) : nodeText(spec, node);
  }
  if (node.type === 'image') {
    return `![${String(node.attrs?.['alt'] ?? '')}](${String(node.attrs?.['src'] ?? '')})`;
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  let out = node.text ?? '';
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') {
      out = `**${out}**`;
    } else if (mark.type === 'italic') {
      out = `_${out}_`;
    } else if (mark.type === 'strike') {
      out = `~~${out}~~`;
    } else if (mark.type === 'code') {
      out = `\`${out}\``;
    } else if (mark.type === 'link') {
      out = `[${out}](${String(mark.attrs?.['href'] ?? '')})`;
    }
    // Underline, highlight, colour and alignment have no markdown: the text stays, plain.
  }
  return out;
}

/**
 * A document as markdown, in the subset `markdownToDoc` reads, so the round
 * trip settles after one pass. What markdown can't hold (a callout, details,
 * underline, colour) degrades to the nearest thing it can.
 */
export function docToMarkdown(doc: DocNode, nodes: readonly InlineNode[]): string {
  const write: Writer = {
    inline: (content) => (content ?? []).map((node) => inlineMarkdown(node, nodes)).join(''),
    blocks: (content) => {
      return (content ?? [])
        .map((node) => (BLOCK_SERIALIZERS[node.type] ?? paragraphText)(node, write))
        .filter((block) => block.length > 0)
        .join('\n\n');
    },
  };
  return write.blocks(doc.content);
}
