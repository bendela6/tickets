import type { Nodes, Table, TableRow } from 'mdast';
import { Fragment, type ReactNode } from 'react';
import { slug, textOf } from '../parse/text';
import type { Node } from '../registry/types';
import { BlockSlot } from './block-slot';
import type { Definition } from './context';
import { DefaultCodeBlock, type MarkdownElements } from './elements';
import { InlineSlot } from './inline-slot';
import { ImageReferenceSlot, LinkReferenceSlot } from './reference-slots';
import { drawTag } from './tag';

/** Anything the walker meets: a block, or an mdast node at any depth. */
type Walkable = Node | Nodes;

/**
 * Every reference definition (`[id]: /url`) in the page, by mdast's
 * normalised identifier. A definition can sit anywhere relative to the
 * reference that uses it, a block's markdown body included, so this walks
 * every `children`, not only the top level.
 */
export function collectDefinitions(nodes: readonly (Node | Nodes)[]): Map<string, Definition> {
  const map = new Map<string, Definition>();
  const walk = (list: readonly Walkable[]) => {
    for (const node of list) {
      if (node.type === 'definition') {
        map.set(node.identifier, { url: node.url, title: node.title ?? null });
      }
      if ('children' in node && node.children) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return map;
}

/** Draws a list of nodes with the host's elements; a block renderer calls it for its own. */
export function renderNodes(
  nodes: readonly (Node | Nodes)[] | undefined,
  elements: MarkdownElements,
  keyPrefix = 'n',
): ReactNode {
  return (nodes ?? []).map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    return <Fragment key={key}>{renderNode(node, elements, key)}</Fragment>;
  });
}

function renderNode(node: Walkable, elements: MarkdownElements, key: string): ReactNode {
  const kids = () => renderNodes('children' in node ? node.children : undefined, elements, key);

  switch (node.type) {
    case 'block':
      return <BlockSlot node={node} renderChildren={kids} />;
    case 'paragraph':
      return drawTag(elements, 'p', null, kids());
    case 'heading':
      return drawTag(elements, `h${node.depth}`, { id: slug(textOf(node)) }, kids());
    case 'text':
      return renderText(node.value, key);
    case 'strong':
      return drawTag(elements, 'strong', null, kids());
    case 'emphasis':
      return drawTag(elements, 'em', null, kids());
    case 'delete':
      return drawTag(elements, 'del', null, kids());
    case 'inlineCode':
      return drawTag(elements, 'code', null, node.value);
    case 'code': {
      const CodeBlock = elements.codeBlock ?? DefaultCodeBlock;
      return (
        <CodeBlock lang={node.lang ?? undefined} meta={node.meta ?? undefined} value={node.value} />
      );
    }
    case 'link':
      return drawTag(elements, 'a', { href: node.url, title: node.title ?? undefined }, kids());
    case 'list':
      return node.ordered
        ? drawTag(elements, 'ol', { start: node.start ?? undefined }, kids())
        : drawTag(elements, 'ul', null, kids());
    case 'listItem':
      return drawTag(elements, 'li', null, kids());
    case 'blockquote':
      return drawTag(elements, 'blockquote', null, kids());
    case 'thematicBreak':
      return drawTag(elements, 'hr', null);
    case 'break':
      return drawTag(elements, 'br', null);
    case 'table':
      return renderTable(node, elements, key);
    case 'image':
      return drawTag(elements, 'img', {
        src: node.url,
        alt: node.alt ?? '',
        title: node.title ?? undefined,
      });
    case 'imageReference':
      return <ImageReferenceSlot node={node} />;
    case 'linkReference':
      return <LinkReferenceSlot node={node} inner={kids()} />;
    case 'footnoteReference': {
      const link = { href: `#fn-${node.identifier}`, id: `fnref-${node.identifier}` };
      return drawTag(
        elements,
        'sup',
        null,
        drawTag(elements, 'a', link, node.label ?? node.identifier),
      );
    }
    case 'footnoteDefinition':
      return <div id={`fn-${node.identifier}`}>{kids()}</div>;
    default:
      // Definitions, raw HTML and the rest draw nothing.
      return null;
  }
}

function renderTable(node: Table, elements: MarkdownElements, key: string): ReactNode {
  const [head, ...body] = node.children;
  return drawTag(
    elements,
    'table',
    null,
    <>
      {drawTag(elements, 'thead', null, head ? renderRow(head, true, elements, `${key}-h`) : null)}
      {drawTag(
        elements,
        'tbody',
        null,
        body.map((row, index) => {
          const rowKey = `${key}-${index}`;
          return <Fragment key={rowKey}>{renderRow(row, false, elements, rowKey)}</Fragment>;
        }),
      )}
    </>,
  );
}

function renderRow(
  row: TableRow,
  header: boolean,
  elements: MarkdownElements,
  key: string,
): ReactNode {
  return drawTag(
    elements,
    'tr',
    null,
    row.children.map((cell, index) => {
      const cellKey = `${key}-${index}`;
      const content = renderNodes(cell.children, elements, cellKey);
      return (
        <Fragment key={cellKey}>{drawTag(elements, header ? 'th' : 'td', null, content)}</Fragment>
      );
    }),
  );
}

const INLINE = /:([A-Za-z][\w-]*)\[([^\]]*)\](\{[^}]*\})?/g;

/** A run of text, with any inline marks in it drawn by their renderers. */
function renderText(value: string, key: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;

  for (const match of value.matchAll(INLINE)) {
    const [raw, name = '', label = '', attrsSource = ''] = match;
    const at = match.index;
    if (at > last) {
      out.push(value.slice(last, at));
    }
    out.push(
      <InlineSlot
        key={`${key}-i${at}`}
        name={name}
        label={label}
        attrsSource={attrsSource}
        raw={raw}
      />,
    );
    last = at + raw.length;
  }

  if (out.length === 0) {
    return value;
  }
  if (last < value.length) {
    out.push(value.slice(last));
  }
  return out;
}
