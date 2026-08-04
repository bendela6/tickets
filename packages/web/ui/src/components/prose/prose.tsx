import { Markdown, type MarkdownComponents } from '@tanstack/markdown/react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../style';

// Markdown authored elsewhere — a task description, a decision's context — rendered as
// prose inside otherwise dense screens.
//
// Every element is mapped to a real component carrying token classes rather than styled
// through descendant selectors, so the output is ordinary React and nothing reaches for
// dangerouslySetInnerHTML. That matters here: this text is written by agents and tools,
// not by the app, so it is never trusted enough to inject as HTML.

type El<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithoutRef<T>;

const H1 = (p: El<'h1'>) => (
  <h1 {...p} className="mt-20 mb-8 font-semibold text-15 text-gray-12 first:mt-0" />
);
const H2 = (p: El<'h2'>) => (
  <h2 {...p} className="mt-20 mb-8 font-semibold text-14 text-gray-12 first:mt-0" />
);
const H3 = (p: El<'h3'>) => (
  <h3 {...p} className="mt-16 mb-4 font-semibold text-13 text-gray-12 first:mt-0" />
);
const P = (p: El<'p'>) => <p {...p} className="my-8 text-13/19 text-gray-11 first:mt-0 last:mb-0" />;
const Ul = (p: El<'ul'>) => <ul {...p} className="my-8 ml-16 list-disc space-y-4" />;
const Ol = (p: El<'ol'>) => <ol {...p} className="my-8 ml-16 list-decimal space-y-4" />;
const Li = (p: El<'li'>) => <li {...p} className="text-13/19 text-gray-11" />;
const Strong = (p: El<'strong'>) => <strong {...p} className="font-semibold text-gray-12" />;
const Em = (p: El<'em'>) => <em {...p} className="italic" />;
const A = (p: El<'a'>) => (
  <a {...p} className="text-indigo-11 underline underline-offset-2" rel="noreferrer" />
);
const Code = (p: El<'code'>) => (
  <code
    {...p}
    className="rounded-sm bg-surface-inset px-4 py-2 font-mono text-12 text-gray-12"
  />
);
// The <code> inside a fence inherits the block's type, so its own chrome is removed.
const Pre = (p: El<'pre'>) => (
  <pre
    {...p}
    className="my-12 overflow-x-auto rounded-md bg-surface-inset p-12 font-mono text-12/17 text-gray-12"
  />
);
const Blockquote = (p: El<'blockquote'>) => (
  <blockquote {...p} className="my-12 border-gray-6 border-l-2 pl-12 text-gray-11 italic" />
);
const Hr = (p: El<'hr'>) => <hr {...p} className="my-16 border-gray-6" />;
const Table = (p: El<'table'>) => (
  <div className="my-12 overflow-x-auto">
    <table {...p} className="w-full border-collapse text-12/17" />
  </div>
);
const Th = (p: El<'th'>) => (
  <th
    {...p}
    className="border-gray-6 border-b-1 px-8 py-4 text-left font-semibold text-gray-12"
  />
);
const Td = (p: El<'td'>) => (
  <td {...p} className="border-gray-6 border-b-1 px-8 py-4 align-top text-gray-11" />
);
const Img = (p: El<'img'>) => <img {...p} alt={p.alt ?? ''} className="my-12 max-w-full rounded-sm" />;

const COMPONENTS: MarkdownComponents = {
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
  pre: Pre,
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
 * Supports the subset TanStack Markdown implements — headings, emphasis, code,
 * links, images, lists, tables and footnotes — not the whole of CommonMark. Empty
 * or missing input renders nothing rather than an empty box.
 */
export function Prose({
  children,
  className,
}: {
  children: string | null | undefined;
  className?: string;
}) {
  if (!children?.trim()) return null;
  return (
    <div className={cn('min-w-0', className)}>
      <Markdown components={COMPONENTS}>{children}</Markdown>
    </div>
  );
}
