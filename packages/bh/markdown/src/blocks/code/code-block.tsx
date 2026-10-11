import { useMemo } from 'react';
import { cn, CopyButton } from '@bh/ui';
import { highlightLines, isBlankLine } from '../../highlight';

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
}

const NONE: ReadonlySet<number> = new Set();

/**
 * A fragment, not a file: a strip naming the file or language with a copy
 * control, then the lines, numbered, with the ones the passage is about
 * marked. A long line scrolls inside the frame rather than wrapping, since
 * wrapping would change what the code says.
 */
export function CodeBlock({ value, lang, file, marked = NONE, numbers = true }: CodeBlockProps) {
  const text = value.replace(/\n$/, '');
  const lines = useMemo(() => highlightLines(text, lang), [text, lang]);

  return (
    <div
      data-lang={lang}
      className="rounded-6 border-gray-6 mt-16 overflow-hidden border-1 first:mt-0"
    >
      <div className="bg-surface-inset border-gray-6 flex h-36 items-center gap-8 border-b-1 pr-6 pl-12">
        {file ? (
          <span className="text-12 text-gray-12 min-w-0 truncate font-mono">{file}</span>
        ) : null}
        <span className="flex-1" />
        {lang ? <span className="text-11 text-gray-10 font-mono">{lang}</span> : null}
        <CopyButton value={text} />
      </div>
      <pre className="text-13/20 text-gray-12 overflow-x-auto py-12 font-mono">
        <code className={cn('grid', numbers ? 'grid-cols-[auto_1fr]' : 'grid-cols-1')}>
          {lines.map((line, index) => {
            const number = index + 1;
            const isMarked = marked.has(number);
            const isDimmed = marked.size > 0 && !isMarked;
            return (
              <span
                key={number}
                data-line={number}
                data-mark={isMarked ? 'true' : undefined}
                className="contents"
              >
                {numbers ? (
                  <span
                    aria-hidden
                    className={cn(
                      'border-l-2 pr-16 pl-12 text-right tabular-nums select-none',
                      isMarked
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
                    isMarked && 'bg-indigo-3',
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
