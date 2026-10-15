// Under the code: what is wrong with it, one row a problem.

import { cn, Icon } from '@bh/ui';
import type { CodeProblem } from '../problems';

/** One row per problem: its glyph, its line when known, and what is wrong. */
export function ProblemsStrip({ problems }: { problems: readonly CodeProblem[] }) {
  if (problems.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Problems" className="border-gray-6 flex flex-col border-t-1">
      {problems.map((problem) => {
        const error = problem.severity === 'error';
        return (
          <li
            key={`${problem.line ?? 0}-${problem.message}`}
            className={cn(
              'text-12/18 flex items-start gap-8 px-12 py-8',
              error ? 'bg-red-2 text-red-11' : 'bg-orange-2 text-orange-11',
            )}
          >
            <Icon name={error ? 'circle-x' : 'triangle-alert'} className="mt-2" />
            {problem.line === undefined ? null : (
              <span className="shrink-0 font-mono tabular-nums">Line {problem.line}</span>
            )}
            <span className="text-gray-12 min-w-0 break-words">{problem.message}</span>
          </li>
        );
      })}
    </ul>
  );
}
