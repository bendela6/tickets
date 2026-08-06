import { parseDoc, type DocNode } from './detect';
import { parseInline } from './inline-parse';

const para = (content: DocNode[]): DocNode => ({ type: 'paragraph', content });

const codeBlock = (lines: string[]): DocNode => ({
  type: 'codeBlock',
  content: lines.length > 0 ? [{ type: 'text', text: lines.join('\n') }] : [],
});

export function markdownToDoc(md: string): DocNode {
  const lines = md.split(/\r?\n/);
  const blocks: DocNode[] = [];
  let list: DocNode | null = null; // current bulletList/orderedList/taskList
  let table: DocNode | null = null; // current table
  let fence: string[] | null = null; // lines inside ``` fence

  const closeList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };
  const closeTable = () => {
    if (table) {
      blocks.push(table);
      table = null;
    }
  };
  const closeFence = () => {
    if (fence) {
      blocks.push(codeBlock(fence));
      fence = null;
    }
  };

  for (const raw of lines) {
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

    const tableRow = line.match(/^\|(.+)\|$/);
    if (tableRow) {
      const cells = tableRow[1]!.split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{3,}:?$/.test(c))) {
        continue;
      }
      const cellType = table === null ? 'tableHeader' : 'tableCell';
      const row: DocNode = {
        type: 'tableRow',
        content: cells.map((c) => ({ type: cellType, content: [para(parseInline(c))] })),
      };
      if (table === null) {
        closeList();
        table = { type: 'table', content: [row] };
      } else {
        table.content!.push(row);
      }
      continue;
    }
    closeTable();

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      blocks.push({ type: 'heading', attrs: { level: heading[1]!.length }, content: parseInline(heading[2]!) });
      continue;
    }

    const task = line.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (task) {
      if (list?.type !== 'taskList') {
        closeList();
        list = { type: 'taskList', content: [] };
      }
      list.content!.push({
        type: 'taskItem',
        attrs: { checked: task[1]!.toLowerCase() === 'x' },
        content: [para(parseInline(task[2]!))],
      });
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.*)$/);
    if (unordered) {
      if (list?.type !== 'bulletList') {
        closeList();
        list = { type: 'bulletList', content: [] };
      }
      list.content!.push({ type: 'listItem', content: [para(parseInline(unordered[1]!))] });
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      if (list?.type !== 'orderedList') {
        closeList();
        list = { type: 'orderedList', content: [] };
      }
      list.content!.push({ type: 'listItem', content: [para(parseInline(ordered[1]!))] });
      continue;
    }

    closeList();
    if (line.length > 0) {
      blocks.push(para(parseInline(line)));
    }
  }
  closeList();
  closeTable();
  closeFence();
  return { type: 'doc', content: blocks.length > 0 ? blocks : [para([])] };
}

export function toDisplayDoc(text: string): DocNode {
  return parseDoc(text) ?? markdownToDoc(text);
}
