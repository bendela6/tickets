import { parseDoc, type DocNode } from './detect';
import type { InlineNode } from './inline-node';
import { parseInline } from './inline-parse';

type ListType = 'bulletList' | 'orderedList' | 'taskList';

const para = (content: DocNode[]): DocNode => ({ type: 'paragraph', content });

const codeBlock = (lines: string[]): DocNode => {
  return {
    type: 'codeBlock',
    content: lines.length > 0 ? [{ type: 'text', text: lines.join('\n') }] : [],
  };
};

/**
 * Markdown as a document, line by line: headings to H3, bullet, numbered and
 * task lists, fenced code, pipe tables and paragraphs, with the inline syntax
 * and the inline nodes in each line. It never throws; what it can't read stays
 * text.
 */
export function markdownToDoc(md: string, nodes: readonly InlineNode[]): DocNode {
  const inline = (source: string) => parseInline(source, nodes);
  const blocks: DocNode[] = [];
  let list: { type: ListType; items: DocNode[] } | null = null;
  let rows: DocNode[] | null = null;
  let fence: string[] | null = null;

  const closeList = () => {
    if (list) {
      blocks.push({ type: list.type, content: list.items });
      list = null;
    }
  };
  const closeTable = () => {
    if (rows) {
      blocks.push({ type: 'table', content: rows });
      rows = null;
    }
  };
  const closeFence = () => {
    if (fence) {
      blocks.push(codeBlock(fence));
      fence = null;
    }
  };
  // The open list's items, opening a new list when the type changes.
  const itemsOf = (type: ListType): DocNode[] => {
    if (list?.type === type) {
      return list.items;
    }
    closeList();
    const items: DocNode[] = [];
    list = { type, items };
    return items;
  };

  for (const raw of md.split(/\r?\n/)) {
    if (raw.startsWith('```')) {
      closeList();
      closeTable();
      if (fence) {
        closeFence();
      } else {
        fence = [];
      }
      continue;
    }
    if (fence) {
      fence.push(raw);
      continue;
    }
    const line = raw.trimEnd();

    const tableRow = /^\|(.+)\|$/.exec(line);
    if (tableRow) {
      const cells = (tableRow[1] ?? '').split('|').map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        continue;
      }
      // The first row is the header.
      const cellType = rows === null ? 'tableHeader' : 'tableCell';
      const row: DocNode = {
        type: 'tableRow',
        content: cells.map((cell) => ({ type: cellType, content: [para(inline(cell))] })),
      };
      if (rows === null) {
        closeList();
        rows = [row];
      } else {
        rows.push(row);
      }
      continue;
    }
    closeTable();

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      blocks.push({
        type: 'heading',
        attrs: { level: (heading[1] ?? '#').length },
        content: inline(heading[2] ?? ''),
      });
      continue;
    }

    const task = /^[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    if (task) {
      itemsOf('taskList').push({
        type: 'taskItem',
        attrs: { checked: task[1]?.toLowerCase() === 'x' },
        content: [para(inline(task[2] ?? ''))],
      });
      continue;
    }
    const unordered = /^[-*]\s+(.*)$/.exec(line);
    if (unordered) {
      itemsOf('bulletList').push({ type: 'listItem', content: [para(inline(unordered[1] ?? ''))] });
      continue;
    }
    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (ordered) {
      itemsOf('orderedList').push({ type: 'listItem', content: [para(inline(ordered[1] ?? ''))] });
      continue;
    }

    closeList();
    if (line.length > 0) {
      blocks.push(para(inline(line)));
    }
  }
  closeList();
  closeTable();
  closeFence();
  return { type: 'doc', content: blocks.length > 0 ? blocks : [para([])] };
}

/** A stored value as a document to show: the document itself, or its markdown converted. */
export function toDisplayDoc(text: string, nodes: readonly InlineNode[]): DocNode {
  return parseDoc(text) ?? markdownToDoc(text, nodes);
}
