import { MarkdownText, type CodeBlockProps, type MarkdownElements } from '../render';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@bh/ui';

// Markdown authored elsewhere — a task description, a decision's context — rendered as
// prose inside otherwise dense screens.
//
// Every element is mapped to a real component carrying token classes rather than styled
// through descendant selectors, so the output is ordinary React and nothing reaches for
// dangerouslySetInnerHTML. That matters here: this text is written by agents and tools,
// not by the app, so it is never trusted enough to inject as HTML. It is drawn by
// @bh/markdown as plain markdown: a fence or a `:::` in it is text, never a block.

type El<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithoutRef<T>;

// A heading leaves out the id the engine gives it: a screen holds many of these,
// and two notes with the same heading would share it.
const H1 = ({ id: _id, ...p }: El<'h1'>) => {
  return <h1 {...p} className="text-15 text-gray-12 mt-20 mb-8 font-semibold first:mt-0" />;
};
const H2 = ({ id: _id, ...p }: El<'h2'>) => {
  return <h2 {...p} className="text-14 text-gray-12 mt-20 mb-8 font-semibold first:mt-0" />;
};
const H3 = ({ id: _id, ...p }: El<'h3'>) => {
  return <h3 {...p} className="text-13 text-gray-12 mt-16 mb-4 font-semibold first:mt-0" />;
};
const P = (p: El<'p'>) => {
  return <p {...p} className="text-13/19 text-gray-11 my-8 first:mt-0 last:mb-0" />;
};
const Ul = (p: El<'ul'>) => <ul {...p} className="my-8 ml-16 list-disc space-y-4" />;
const Ol = (p: El<'ol'>) => <ol {...p} className="my-8 ml-16 list-decimal space-y-4" />;
const Li = (p: El<'li'>) => <li {...p} className="text-13/19 text-gray-11" />;
const Strong = (p: El<'strong'>) => <strong {...p} className="text-gray-12 font-semibold" />;
const Em = (p: El<'em'>) => <em {...p} className="italic" />;
/** An address with a scheme other than the web's or mail's (`javascript:`, `data:`) is no link. */
const UNSAFE_HREF = /^(?!https?:|mailto:)[a-z][a-z\d+.-]*:/i;
const A = ({ href, ...p }: El<'a'>) => {
  if (href === undefined || UNSAFE_HREF.test(href.trim())) {
    return <span>{p.children}</span>;
  }
  return (
    <a
      {...p}
      href={href}
      className="text-indigo-11 underline underline-offset-2"
      rel="noreferrer"
    />
  );
};
const Code = (p: El<'code'>) => {
  return (
    <code {...p} className="rounded-4 bg-surface-inset text-12 text-gray-12 px-4 py-2 font-mono" />
  );
};
/** A fence: its code as written, in the block's type, with no chrome of the inline kind. */
const CodeBlock = ({ value }: CodeBlockProps) => {
  return (
    <pre className="rounded-6 bg-surface-inset text-12/17 text-gray-12 my-12 overflow-x-auto p-12 font-mono">
      <code>{value}</code>
    </pre>
  );
};
const Blockquote = (p: El<'blockquote'>) => {
  return <blockquote {...p} className="border-gray-6 text-gray-11 my-12 border-l-2 pl-12 italic" />;
};
const Hr = (p: El<'hr'>) => <hr {...p} className="border-gray-6 my-16" />;
const Table = (p: El<'table'>) => {
  return (
    <div className="my-12 overflow-x-auto">
      <table {...p} className="text-12/17 w-full border-collapse" />
    </div>
  );
};
const Th = (p: El<'th'>) => {
  return (
    <th
      {...p}
      className="border-gray-6 text-gray-12 border-b-1 px-8 py-4 text-left font-semibold"
    />
  );
};
const Td = (p: El<'td'>) => {
  return <td {...p} className="border-gray-6 text-gray-11 border-b-1 px-8 py-4 align-top" />;
};
const Img = (p: El<'img'>) => {
  return <img {...p} alt={p.alt ?? ''} className="rounded-4 my-12 max-w-full" />;
};

const ELEMENTS: MarkdownElements = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H3,
  h5: H3,
  h6: H3,
  p: P,
  ul: Ul,
  ol: Ol,
  li: Li,
  strong: Strong,
  em: Em,
  a: A,
  code: Code,
  codeBlock: CodeBlock,
  blockquote: Blockquote,
  hr: Hr,
  table: Table,
  th: Th,
  td: Td,
  img: Img,
};

/**
 * Renders a markdown string as prose.
 *
 * CommonMark and GitHub's additions (tables, strikethrough, footnotes), through
 * @bh/markdown with no blocks; raw HTML draws nothing. Empty or missing input
 * renders nothing rather than an empty box.
 */
export function Prose({
  children,
  className,
}: {
  /** The markdown to draw. Empty, blank or missing, nothing renders. */
  children: string | null | undefined;
  /** Added to the wrapper's classes. */
  className?: string;
}) {
  if (!children?.trim()) {
    return null;
  }
  return (
    <div className={cn('min-w-0', className)}>
      <MarkdownText source={children} elements={ELEMENTS} />
    </div>
  );
}
