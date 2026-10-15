import type { DocNode } from '@bh/richtext';
import { useMemo, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@bh/ui';
import { MarkdownText, type MarkdownElements } from '../render';
import { documentOf, drawNode, isBlank, UNSAFE_HREF, type ProseNodes } from './document';
import { BH_NODES } from './nodes';

// Text authored elsewhere (a task's description, a comment, a release's notes),
// drawn as prose: markdown, or the document @bh/richtext's editor stores.
//
// Both are drawn as ordinary React, and nothing reaches for
// dangerouslySetInnerHTML: this text is written by people, agents and tools,
// not by the app, so it is never trusted enough to inject as HTML. Markdown is
// drawn by @bh/markdown as plain markdown (a fence or a `:::` in it is text,
// never a block); a document is walked here, node by node, so showing one
// loads no Tiptap. Both wear the editor's look, `.rt`, so text reads as it
// edits.

type El<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithoutRef<T>;

// A heading leaves out the id the engine gives it: a screen holds many of these,
// and two notes with the same heading would share it.
const H1 = ({ id: _id, ...p }: El<'h1'>) => <h1 {...p} />;
const H2 = ({ id: _id, ...p }: El<'h2'>) => <h2 {...p} />;
const H3 = ({ id: _id, ...p }: El<'h3'>) => <h3 {...p} />;
const H4 = ({ id: _id, ...p }: El<'h4'>) => <h4 {...p} />;
const H5 = ({ id: _id, ...p }: El<'h5'>) => <h5 {...p} />;
const H6 = ({ id: _id, ...p }: El<'h6'>) => <h6 {...p} />;
const A = ({ href, ...p }: El<'a'>) => {
  if (href === undefined || UNSAFE_HREF.test(href.trim())) {
    return <span>{p.children}</span>;
  }
  return <a {...p} href={href} rel="noreferrer" />;
};
const Img = (p: El<'img'>) => <img {...p} alt={p.alt ?? ''} />;

const ELEMENTS: MarkdownElements = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  h5: H5,
  h6: H6,
  a: A,
  img: Img,
};

export interface ProseProps {
  /**
   * The text: markdown, or an editor's document, as its JSON (the text
   * `@bh/richtext` stores, starting `{"type":"doc"`) or as the document
   * itself. Empty, blank or missing, nothing renders.
   */
  children: string | DocNode | null | undefined;
  /**
   * How a document's nodes are drawn, by the node's `type`: the app's own
   * (a chip naming one of its records), or its own way of drawing one of
   * bh's (`callout`, `mention`, `image`). Keep the object stable.
   */
  nodes?: ProseNodes;
  /** Added to the wrapper's classes. */
  className?: string;
}

/**
 * Draws text as prose: markdown, or the document `@bh/richtext`'s editor
 * stores, in the editor's look.
 *
 * Markdown is CommonMark and GitHub's additions (tables, strikethrough,
 * footnotes), drawn by @bh/markdown with no blocks; raw HTML draws nothing. A
 * document is walked node by node, each drawn as the editor draws it, with the
 * app's renderers for its own nodes. Empty or missing text renders nothing
 * rather than an empty box.
 */
export function Prose({ children, nodes, className }: ProseProps) {
  const renderers = useMemo((): ProseNodes => ({ ...BH_NODES, ...nodes }), [nodes]);
  const doc = typeof children === 'string' ? documentOf(children) : (children ?? null);
  if (doc !== null) {
    if (isBlank(doc)) {
      return null;
    }
    return (
      <div className={cn('rt min-w-0', className)} data-rt-doc="">
        {drawNode(doc, renderers)}
      </div>
    );
  }
  if (typeof children !== 'string' || !children.trim()) {
    return null;
  }
  return (
    <div className={cn('rt min-w-0', className)}>
      <MarkdownText source={children} elements={ELEMENTS} />
    </div>
  );
}
