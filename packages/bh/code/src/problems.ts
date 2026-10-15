/** How bad a line's problem is: an error stops the code working; a warning is worth a look. */
export type ProblemSeverity = 'error' | 'warning';

/**
 * The lines with a problem, numbered from 1, each with how bad its worst is.
 * A code block and an editor mark them alike: the number in the problem's
 * tone, the line tinted.
 */
export type LineProblems = ReadonlyMap<number, ProblemSeverity>;

/**
 * Something wrong with a piece of code, as the app found it: compiling it,
 * running it, or checking its types. An example panel lists them under the
 * code and marks their lines.
 */
export interface CodeProblem {
  /** The line it is on, from 1, when it is known. */
  line?: number;
  /** An error stops the code working; a warning never does. */
  severity: ProblemSeverity;
  /** What is wrong, in words. */
  message: string;
}

/**
 * The lines the problems are on, each with its worst, for a code block's or
 * an editor's `problems`. A problem on no line marks none.
 *
 * @param problems What is wrong with the code, in any order.
 */
export function problemLines(problems: readonly CodeProblem[]): LineProblems {
  const lines = new Map<number, ProblemSeverity>();
  for (const problem of problems) {
    if (problem.line !== undefined && lines.get(problem.line) !== 'error') {
      lines.set(problem.line, problem.severity);
    }
  }
  return lines;
}
