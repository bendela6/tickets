// How a text in markdown, or a rich text, reads as plain text: what a cell, a
// tooltip, an export and an answer from MCP show of it. The text formats of
// the format registry write them. @bh/ui sits below @bh/markdown and
// @bh/richtext, so the text renderer draws this reading, never the syntax.

const FENCE = /^\s*(?:`{3,}|~{3,})/;
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const UNDERLINE = /^\s*(?:=+|-+)\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const TABLE_ROW = /^\s*\|(.*)\|\s*$/;
// A line's block marks: quotes, then a heading's hashes or a list's bullet or
// number, and a task's box.
const BLOCK = /^\s*(?:>\s?)*\s*(?:#{1,6}\s+|(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?)?/;

// A character a backslash escapes is hidden as a private-use character while
// the marks come off, so `\*not emphasis\*` keeps its stars.
const ESCAPED = /\\([\\`*_{}[\]()#+\-.!~|>])/g;
const HIDDEN = /[-]/g;
const HIDING_PLACE = 0xe000;

/** A line without the marks of its inline syntax: links, images, code, emphasis. */
function withoutInlineMarks(line: string): string {
  return line
    .replace(ESCAPED, (_escape, char: string) => {
      return String.fromCharCode(HIDING_PLACE + char.charCodeAt(0));
    })
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, '$1')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/(`+)(.+?)\1/g, '$2')
    .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '$1')
    .replace(/(?<!\w)_(?=\S)(.+?)(?<=\S)_(?!\w)/g, '$1')
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '$1')
    .replace(HIDDEN, (hidden) => {
      return String.fromCharCode(hidden.charCodeAt(0) - HIDING_PLACE);
    });
}

/** A table's rule under its header: `| --- | :-: |`. */
function isTableRule(line: string): boolean {
  return line.includes('|') && TABLE_RULE.test(line);
}

/** A table row's cells, side by side. */
function cellsOf(line: string): string {
  const row = TABLE_ROW.exec(line);
  return row?.[1] === undefined
    ? line
    : row[1]
        .split('|')
        .map((cell) => {
          return cell.trim();
        })
        .join(' ');
}

/**
 * Markdown as the text it reads as: headings, lists, quotes, links, images,
 * emphasis and code without their marks, a link as its words, a code block as
 * its lines, a rule and a table's rule left out, one line to a block or a
 * list item, blank lines gone. The common syntax of CommonMark, not all of
 * it: what @bh/markdown draws is the page, and this is its text.
 */
export function readMarkdown(source: string): string {
  const lines: string[] = [];
  let fenced = false;
  for (const line of source.split(/\r\n|\r|\n/)) {
    if (FENCE.test(line)) {
      fenced = !fenced;
    } else if (fenced) {
      lines.push(line.trimEnd());
    } else if (!RULE.test(line) && !UNDERLINE.test(line) && !isTableRule(line)) {
      lines.push(withoutInlineMarks(cellsOf(line.replace(BLOCK, ''))).trim());
    }
  }
  return lines
    .filter((line) => {
      return line.trim() !== '';
    })
    .join('\n');
}

/** A rich text's branch: a document, a block or a piece of text, as its JSON is written. */
interface Branch {
  type?: unknown;
  text?: unknown;
  content?: unknown;
}

function branchOf(value: unknown): Branch | undefined {
  return typeof value === 'object' && value !== null ? value : undefined;
}

function childrenOf(branch: Branch | undefined): (Branch | undefined)[] {
  return Array.isArray(branch?.content) ? branch.content.map(branchOf) : [];
}

/** Whether a branch is written inside a line: some text, or a break in it. */
function isInline(branch: Branch | undefined): boolean {
  return branch?.type === 'text' || branch?.type === 'hardBreak';
}

/** A line's text: its pieces of text joined, a break between them a new line. */
function inlineText(branch: Branch | undefined): string {
  if (typeof branch?.text === 'string') {
    return branch.text;
  }
  if (branch?.type === 'hardBreak') {
    return '\n';
  }
  return childrenOf(branch).map(inlineText).join('');
}

/** A branch's lines: a block holding text is one, a block holding blocks is theirs. */
function linesOf(branch: Branch | undefined): string[] {
  const children = childrenOf(branch);
  return children.some(isInline)
    ? [inlineText(branch)]
    : children.flatMap((child) => {
        return linesOf(child);
      });
}

/**
 * A rich text, its document as JSON text (@bh/richtext's), as the words in it,
 * a block to a line: a paragraph, a heading, a list item. Text that is not a
 * document comes back as it is, so a value that is broken still shows.
 */
export function readRichText(source: string): string {
  let doc: unknown;
  try {
    doc = JSON.parse(source);
  } catch {
    return source;
  }
  return linesOf(branchOf(doc))
    .filter((line) => {
      return line.trim() !== '';
    })
    .join('\n');
}
