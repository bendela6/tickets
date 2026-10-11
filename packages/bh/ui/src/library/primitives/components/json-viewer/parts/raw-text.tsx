import { Fragment } from 'react';
import { cn } from '../../../../../style/cn';
import { LineNumber } from './line-number';

/**
 * The body when the text is not JSON: the text as given, with the failing line marked.
 *
 * Nothing is reformatted and nothing is editable here - there is no parse to reformat or edit
 * from, and what the reader is looking for is the character the parser stopped at.
 */
export function RawText({
  text,
  errorLine,
  lineNumbers,
}: {
  text: string;
  errorLine: number | null;
  lineNumbers: boolean;
}) {
  return (
    <>
      {text.split('\n').map((content, index) => {
        const line = index + 1;
        const failed = line === errorLine;
        return (
          <Fragment key={line}>
            {lineNumbers && <LineNumber line={line} tone={failed ? 'error' : undefined} />}
            <span
              className={cn(
                'text-11/16 text-gray-12 pr-10 font-mono whitespace-pre',
                failed && 'bg-red-3',
              )}
            >
              {content}
            </span>
          </Fragment>
        );
      })}
    </>
  );
}
