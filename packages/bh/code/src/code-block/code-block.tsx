import { useMemo } from 'react';
import { Button, cn, useCopy } from '@bh/ui';
import { highlightLines, isBlankLine } from '../highlight';
import type { LineProblems, ProblemSeverity } from '../problems';

export interface CodeBlockProps {
  /** The code, verbatim. */
  value: string;
  /** Picks the grammar; one this package has none for shows plain. */
  lang?: string;
  /** Names the fragment in the strip above it. */
  file?: string;
  /** The lines the passage is about; the rest recede. */
  marked?: ReadonlySet<number>;
  /** Numbers in a gutter. On by default. */
  numbers?: boolean;
  /** The lines with a problem: each number in the problem's tone, the line tinted, as an editor marks them. */
  problems?: LineProblems;
  /**
   * The lines alone, with no strip, border or copy control: for a pane that
   * names and frames the code itself, as an example's does.
   */
  bare?: boolean;
}

const NONE: ReadonlySet<number> = new Set();

/** A problem's line: its number in the problem's tone with a bar beside it, the line tinted. */
const PROBLEM_CLASSES: Record<ProblemSeverity, { number: string; line: string }> = {
  error: { number: 'border-red-9 text-red-11', line: 'bg-red-3' },
  warning: { number: 'border-orange-9 text-orange-11', line: 'bg-orange-3' },
};

/**
 * A fragment, not a file: a strip naming the file or language with a copy
 * control, then the lines, numbered, with the ones the passage is about
 * marked. A long line scrolls inside the frame rather than wrapping, since
 * wrapping would change what the code says.
 */
export function CodeBlock({
  value,
  lang,
  file,
  marked = NONE,
  numbers = true,
  problems,
  bare = false,
}: CodeBlockProps) {
  const text = value.replace(/\n$/, '');
  const lines = useMemo(() => highlightLines(text, lang), [text, lang]);
  const { copied, failed, copy } = useCopy();

  return (
    <div
      data-lang={lang}
      className={cn(!bare && 'rounded-6 border-gray-6 mt-16 overflow-hidden border-1 first:mt-0')}
    >
      {bare ? null : (
        <div className="bg-surface-inset border-gray-6 flex h-36 items-center gap-8 border-b-1 pr-6 pl-12">
          {file ? (
            <span className="text-12 text-gray-12 min-w-0 truncate font-mono">{file}</span>
          ) : null}
          <span className="flex-1" />
          {lang ? <span className="text-11 text-gray-10 font-mono">{lang}</span> : null}
          <Button
            variant="ghost"
            tone={copied ? 'success' : failed ? 'danger' : 'neutral'}
            size="xs"
            icon={copied ? 'check' : failed ? 'x' : 'copy'}
            label={copied ? 'Copied' : failed ? 'Could not copy' : 'Copy'}
            onClick={() => void copy(text)}
          />
        </div>
      )}
      <pre className="text-13/20 text-gray-12 overflow-x-auto py-12 font-mono">
        <code className={cn('grid', numbers ? 'grid-cols-[auto_1fr]' : 'grid-cols-1')}>
          {lines.map((line, index) => {
            const number = index + 1;
            const isMarked = marked.has(number);
            const isDimmed = marked.size > 0 && !isMarked;
            const problem = problems?.get(number);
            return (
              <span
                key={number}
                data-line={number}
                data-mark={isMarked ? 'true' : undefined}
                data-problem={problem}
                className="contents"
              >
                {numbers ? (
                  <span
                    aria-hidden
                    className={cn(
                      'border-l-2 pr-16 pl-12 text-right tabular-nums select-none',
                      problem
                        ? PROBLEM_CLASSES[problem].number
                        : isMarked
                          ? 'border-indigo-9 text-indigo-11'
                          : 'text-gray-8 border-transparent',
                    )}
                  >
                    {number}
                  </span>
                ) : null}
                <span
                  data-code
                  className={cn(
                    'pr-16 whitespace-pre',
                    !numbers && 'pl-12',
                    problem ? PROBLEM_CLASSES[problem].line : isMarked && 'bg-indigo-3',
                    isDimmed && 'opacity-50',
                  )}
                >
                  {isBlankLine(line) ? '\n' : line}
                </span>
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
