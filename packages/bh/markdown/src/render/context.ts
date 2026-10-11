import { createContext, useContext } from 'react';
import type { Doc, Registry, RenderContext } from '../registry/types';
import type { MarkdownElements } from './elements';

/** Where a reference link or image points: `[id]: /url "title"`. */
export interface Definition {
  url: string;
  title?: string | null;
}

/** What `useDocContext` gives a block: the page it is in, and what it is drawn with. */
export interface DocContextValue {
  /** The blocks the page is drawn with, for a block that parses markdown of its own. */
  registry: Registry;
  /** The page being drawn. */
  doc: Doc;
  /** What the host handed `DocView`. */
  ctx: RenderContext;
  /** The page's link definitions (`[id]: /url`), by identifier. */
  definitions: Map<string, Definition>;
  /** The host's elements, to draw nodes with: `renderNodes(nodes, elements)`. */
  elements: MarkdownElements;
}

const DocContext = createContext<DocContextValue | null>(null);

export const DocProvider = DocContext.Provider;

/** The page a block is drawn in; a block renderer reads it to walk its own nodes. */
export function useDocContext(): DocContextValue {
  const value = useContext(DocContext);
  if (!value) {
    throw new Error('A block was rendered outside a DocView');
  }
  return value;
}
