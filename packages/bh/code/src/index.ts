// Everything code: the syntax map every fragment is coloured through, the
// grammars, a code block that shows a fragment and an editor that writes one,
// so code reads the same wherever an app shows it; and an example panel, a
// result beside the code that draws it.
export * from './highlight';
export * from './code-block';
export * from './editor';
export * from './example-panel';
export {
  problemLines,
  type CodeProblem,
  type LineProblems,
  type ProblemSeverity,
} from './problems';
