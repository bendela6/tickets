import type { DocMark, DocNode } from '@bh/richtext';
import { Fragment, type ComponentType, type CSSProperties, type ReactNode } from 'react';

// An editor's document, drawn as plain React: the JSON @bh/richtext stores,
// walked here, so showing it loads no Tiptap. Only @bh/richtext's types come
// in. Each node is drawn as the editor draws it (the same elements, the same
// data attributes), so the editor's look, `.rt`, reads the same on both.

/** What a node's renderer is handed. */
export interface ProseNodeProps {
  /** The node, as the document holds it: its `type`, its `attrs`, its `content`. */
  node: DocNode;
  /** Its content, drawn; none for a node that holds none, such as a chip. */
  children?: ReactNode;
}

/**
 * The renderers for a document's nodes, by the node's `type`: an app's own
 * (`ticketRef`), or one of bh's it draws its own way. Keep the object stable.
 */
export type ProseNodes = Readonly<Record<string, ComponentType<ProseNodeProps>>>;

/** How a stored document starts, which tells it from markdown text. */
const DOC_SENTINEL = '{"type":"doc"';

/** The document a text stands for, or null when it is markdown (or a document that no longer parses). */
export function documentOf(text: string): DocNode | null {
  if (!text.startsWith(DOC_SENTINEL)) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return isDocument(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Whether a value is a document's root. */
export function isDocument(value: unknown): value is DocNode {
  return typeof value === 'object' && value !== null && (value as DocNode).type === 'doc';
}

/** Nodes that hold text or nothing, rather than standing for something. */
const HOLDERS = new Set(['doc', 'paragraph', 'heading', 'text', 'hardBreak']);

/** Whether a document shows nothing: no words, and nothing standing in for them (an image, a chip, a rule). */
export function isBlank(doc: DocNode): boolean {
  const shows = (node: DocNode): boolean => {
    if (node.text !== undefined) {
      return node.text.trim().length > 0;
    }
    if (!HOLDERS.has(node.type) && (node.content ?? []).length === 0) {
      return true;
    }
    return (node.content ?? []).some(shows);
  };
  return !shows(doc);
}

/** An address with a scheme other than the web's or mail's (`javascript:`, `data:`) is no link. */
export const UNSAFE_HREF = /^(?!https?:|mailto:)[a-z][a-z\d+.-]*:/i;

/** An image's address: the web's, a relative one, or an image's own data. */
export function safeSource(src: unknown): string | undefined {
  if (typeof src !== 'string' || src.trim() === '') {
    return undefined;
  }
  const trimmed = src.trim();
  if (/^data:image\//i.test(trimmed) || /^blob:/i.test(trimmed)) {
    return trimmed;
  }
  return UNSAFE_HREF.test(trimmed) ? undefined : trimmed;
}

/** A colour as the toolbar stores one (a token, `var(--color-red-9)`), or one written plainly. */
const COLOR =
  /^(?:#[\da-f]{3,8}|[a-z]+|var\(--[\w-]+\)|(?:rgb|hsl|oklch|oklab)a?\([\d\s.,%/+-]+\))$/i;

function colorOf(attrs: Record<string, unknown> | undefined): string | undefined {
  const color = attrs?.['color'];
  return typeof color === 'string' && COLOR.test(color.trim()) ? color.trim() : undefined;
}

const ALIGN = new Set(['left', 'center', 'right', 'justify']);

/** A block's alignment, as the editor writes it on a paragraph or a heading. */
function alignOf(node: DocNode): CSSProperties | undefined {
  const align = node.attrs?.['textAlign'];
  return typeof align === 'string' && ALIGN.has(align)
    ? { textAlign: align as CSSProperties['textAlign'] }
    : undefined;
}

/** A node's words, run together. */
function textOf(node: DocNode): string {
  return node.text ?? (node.content ?? []).map(textOf).join('');
}

/** A number an attribute holds, if it holds a whole one. */
function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

/** The same mark: its type and its attributes. */
function sameMark(a: DocMark | undefined, b: DocMark | undefined): boolean {
  if (a === undefined || b === undefined) {
    return false;
  }
  return a.type === b.type && JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {});
}

/** A run of text inside a mark, drawn as the editor draws it. */
function drawMark(mark: DocMark, children: ReactNode): ReactNode {
  switch (mark.type) {
    case 'bold':
      return <strong>{children}</strong>;
    case 'italic':
      return <em>{children}</em>;
    case 'underline':
      return <u>{children}</u>;
    case 'strike':
      return <s>{children}</s>;
    case 'code':
      return <code>{children}</code>;
    case 'link': {
      const href = mark.attrs?.['href'];
      if (typeof href !== 'string' || UNSAFE_HREF.test(href.trim())) {
        return <span>{children}</span>;
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
          {children}
        </a>
      );
    }
    case 'highlight': {
      const color = colorOf(mark.attrs);
      return color ? (
        <mark data-color={color} style={{ backgroundColor: color, color: 'inherit' }}>
          {children}
        </mark>
      ) : (
        <mark>{children}</mark>
      );
    }
    case 'textStyle': {
      const color = colorOf(mark.attrs);
      return <span style={color ? { color } : undefined}>{children}</span>;
    }
    default:
      // A mark this doesn't know keeps its text, unmarked.
      return children;
  }
}

/**
 * A block's inline content. Text runs sharing a mark sit in one element of
 * it, outermost first, as the editor joins them: a word in bold and italic
 * inside a bold sentence is one `<strong>` holding an `<em>`.
 */
function drawInline(
  nodes: readonly DocNode[],
  renderers: ProseNodes,
  depth: number,
  key: string,
): ReactNode[] {
  const out: ReactNode[] = [];
  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index];
    if (node === undefined) {
      break;
    }
    const mark = node.marks?.[depth];
    if (mark === undefined) {
      out.push(
        <Fragment key={`${key}-${index}`}>{drawNode(node, renderers, `${key}-${index}`)}</Fragment>,
      );
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < nodes.length && sameMark(nodes[end]?.marks?.[depth], mark)) {
      end += 1;
    }
    const run = nodes.slice(index, end);
    out.push(
      <Fragment key={`${key}-${index}`}>
        {drawMark(mark, drawInline(run, renderers, depth + 1, `${key}-${index}m`))}
      </Fragment>,
    );
    index = end;
  }
  return out;
}

/** A node's content, drawn. A block carries no marks, so blocks are drawn one by one. */
function drawContent(node: DocNode, renderers: ProseNodes, key: string): ReactNode {
  return drawInline(node.content ?? [], renderers, 0, key);
}

/** One node, drawn: by the renderer for its type, or as the editor draws it. */
export function drawNode(node: DocNode, renderers: ProseNodes, key = 'd'): ReactNode {
  const Renderer = renderers[node.type];
  if (Renderer) {
    const content = node.content ? drawContent(node, renderers, key) : undefined;
    return <Renderer node={node}>{content}</Renderer>;
  }
  const children = drawContent(node, renderers, key);
  switch (node.type) {
    case 'doc':
      return children;
    case 'text':
      return node.text ?? '';
    case 'paragraph':
      return <p style={alignOf(node)}>{children}</p>;
    case 'heading': {
      const level = Math.min(Math.max(count(node.attrs?.['level']) ?? 1, 1), 6);
      const Heading = `h${String(level)}` as 'h1';
      return <Heading style={alignOf(node)}>{children}</Heading>;
    }
    case 'bulletList':
      return <ul>{children}</ul>;
    case 'orderedList': {
      const start = count(node.attrs?.['start']);
      return <ol start={start !== undefined && start !== 1 ? start : undefined}>{children}</ol>;
    }
    case 'listItem':
      return <li>{children}</li>;
    case 'taskList':
      return <ul data-type="taskList">{children}</ul>;
    case 'taskItem': {
      const checked = node.attrs?.['checked'] === true;
      // Shown, not ticked here: the checkbox is off, and named by its task.
      return (
        <li data-checked={String(checked)}>
          <label>
            <input type="checkbox" checked={checked} disabled readOnly aria-label={textOf(node)} />
            <span />
          </label>
          <div>{children}</div>
        </li>
      );
    }
    case 'blockquote':
      return <blockquote>{children}</blockquote>;
    case 'codeBlock': {
      const language = node.attrs?.['language'];
      return (
        <pre>
          <code
            className={
              typeof language === 'string' && language ? `language-${language}` : undefined
            }
          >
            {children}
          </code>
        </pre>
      );
    }
    case 'horizontalRule':
      return <hr />;
    case 'hardBreak':
      return <br />;
    case 'table':
      return (
        <table>
          <tbody>{children}</tbody>
        </table>
      );
    case 'tableRow':
      return <tr>{children}</tr>;
    case 'tableHeader':
    case 'tableCell': {
      const Cell = node.type === 'tableHeader' ? 'th' : 'td';
      const colSpan = count(node.attrs?.['colspan']);
      const rowSpan = count(node.attrs?.['rowspan']);
      return (
        <Cell
          colSpan={colSpan !== undefined && colSpan > 1 ? colSpan : undefined}
          rowSpan={rowSpan !== undefined && rowSpan > 1 ? rowSpan : undefined}
        >
          {children}
        </Cell>
      );
    }
    case 'details':
      return <details open={node.attrs?.['open'] === true}>{children}</details>;
    case 'detailsSummary':
      return <summary>{children}</summary>;
    case 'detailsContent':
      return <div data-type="detailsContent">{children}</div>;
    default: {
      // A node with no renderer (an app's chip, drawn with none given) keeps
      // what it holds, or the words it stands for, so nothing is lost.
      if (node.content !== undefined) {
        return children;
      }
      const label = node.attrs?.['label'];
      return typeof label === 'string' ? label : null;
    }
  }
}
