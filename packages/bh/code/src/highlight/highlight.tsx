import { highlightCode, tagHighlighter } from '@lezer/highlight';
import { Fragment, type ReactNode } from 'react';
import { grammarFor } from './grammars';
import { SYNTAX_CLASSES, SYNTAX_TAGS } from './syntax';

/**
 * The syntax map as a Lezer highlighter: what a code block colours with here,
 * and what an editor (CodeMirror's `syntaxHighlighting`) takes.
 */
export const SYNTAX_HIGHLIGHTER = tagHighlighter(
  SYNTAX_TAGS.map(([tag, role]) => {
    return { tag, class: SYNTAX_CLASSES[role] };
  }),
);

/** A line with nothing on it: `[]` from a grammar, `['']` from plain text. */
export const isBlankLine = (line: readonly ReactNode[]): boolean => {
  return line.every((part) => part === '');
};

/**
 * Colours source as React nodes, one array per line. Nodes rather than an
 * HTML string: the input is authored text, and the classes are utilities that
 * theme with the page. A language with no grammar, or none, comes back as
 * plain lines, so a caller draws the same shape either way.
 */
export function highlightLines(code: string, lang?: string): ReactNode[][] {
  const grammar = lang ? grammarFor(lang) : undefined;
  if (!grammar) {
    return code.split('\n').map((line) => [line]);
  }

  const lines: ReactNode[][] = [[]];
  let key = 0;
  highlightCode(
    code,
    grammar.parse(code),
    SYNTAX_HIGHLIGHTER,
    (text, classes) => {
      key += 1;
      lines.at(-1)?.push(
        classes ? (
          <span key={key} className={classes}>
            {text}
          </span>
        ) : (
          <Fragment key={key}>{text}</Fragment>
        ),
      );
    },
    () => {
      lines.push([]);
    },
  );
  return lines;
}
