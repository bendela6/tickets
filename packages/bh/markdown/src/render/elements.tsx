import type { ComponentPropsWithoutRef, ComponentType } from 'react';

/** The HTML elements the walker draws markdown with. */
export type MarkdownTag =
  | 'a'
  | 'blockquote'
  | 'br'
  | 'code'
  | 'del'
  | 'em'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'hr'
  | 'img'
  | 'li'
  | 'ol'
  | 'p'
  | 'strong'
  | 'sup'
  | 'table'
  | 'tbody'
  | 'td'
  | 'th'
  | 'thead'
  | 'tr'
  | 'ul';

/** A component in place of an HTML element, taking that element's props. */
export type TagElements = {
  [Tag in MarkdownTag]?: ComponentType<ComponentPropsWithoutRef<Tag>>;
};

/** A fenced code block that is not a registered block. */
export interface CodeBlockProps {
  /** The fence's first word: ```ts gives `ts`. */
  lang?: string;
  /** The rest of the fence's opening line, after the language. */
  meta?: string;
  /** The code, as written. */
  value: string;
}

/** What a reader sees where a block should have been. */
export interface ErrorCardProps {
  /** What did not render: `Block "callout" failed validation`. */
  title: string;
  /** Why, one reason each, in the validator's or the error's own words. */
  reasons: readonly string[];
}

/**
 * What the host draws markdown with. Anything left out is the plain HTML
 * element, so the package draws nothing of its own look; an `h2` is handed
 * its heading's `id` like any other prop. `code` is inline code only: a code
 * block goes to `codeBlock`, which gets the language and the text.
 */
export interface MarkdownElements extends TagElements {
  /** Draws a fence that is no block: plain `<pre><code>` when left out. */
  codeBlock?: ComponentType<CodeBlockProps>;
  /** Draws a block that could not be drawn, and why: a plain `role="alert"` box when left out. */
  errorCard?: ComponentType<ErrorCardProps>;
}

export function DefaultCodeBlock({ lang, value }: CodeBlockProps) {
  return (
    <pre>
      <code className={lang ? `language-${lang}` : undefined}>{value}</code>
    </pre>
  );
}

/** Unstyled: it says nothing rendered, names what, and lists why. */
export function DefaultErrorCard({ title, reasons }: ErrorCardProps) {
  return (
    <div role="alert">
      <p>Block not rendered</p>
      <p>{title}</p>
      {reasons.length > 0 ? (
        <ul>
          {reasons.map((reason, index) => {
            return <li key={index}>{reason}</li>;
          })}
        </ul>
      ) : null}
    </div>
  );
}
