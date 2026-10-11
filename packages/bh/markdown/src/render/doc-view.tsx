import { useMemo } from 'react';
import { parseDocument } from '../parse/parse';
import type { Doc, Registry, RenderContext } from '../registry/types';
import { DocProvider } from './context';
import type { MarkdownElements } from './elements';
import { collectDefinitions, renderNodes } from './markdown-nodes';

const NO_CONTEXT: RenderContext = {};
const NO_ELEMENTS: MarkdownElements = {};

/** What `DocView` draws, and with what. */
export interface DocViewProps {
  /** The parsed page: from `parsePage`, `parseDocument`, or one of its items. */
  doc: Doc;
  /** The blocks it is drawn with; the one it was parsed with. */
  registry: Registry;
  /** Whatever the host hands every block: the current route, a theme, a data source. */
  ctx?: RenderContext;
  /** The host's components for markdown's elements; keep the object stable. */
  elements?: MarkdownElements;
}

/**
 * Draws a parsed page with the host's elements: its markdown, and each block
 * through its renderer. A block that can't be drawn shows the error card in
 * its place, and the rest of the page still draws.
 */
export function DocView({ doc, registry, ctx = NO_CONTEXT, elements = NO_ELEMENTS }: DocViewProps) {
  const definitions = useMemo(() => collectDefinitions(doc.nodes), [doc]);
  const value = useMemo(() => {
    return { registry, doc, ctx, definitions, elements };
  }, [registry, doc, ctx, definitions, elements]);
  return <DocProvider value={value}>{renderNodes(doc.nodes, elements)}</DocProvider>;
}

/** `DocView`'s props, with a markdown source in place of the parsed page. */
export interface MarkdownDocProps extends Omit<DocViewProps, 'doc'> {
  /** A markdown document: frontmatter, markdown, and blocks as fences and directives. */
  source: string;
}

/**
 * Parses a markdown document and draws it; parses again only when the source
 * or registry changes. A YAML page is read with `parsePage` and drawn with
 * `DocView`.
 */
export function MarkdownDoc({ source, registry, ...rest }: MarkdownDocProps) {
  const doc = useMemo(() => parseDocument(source, registry), [source, registry]);
  return <DocView doc={doc} registry={registry} {...rest} />;
}
