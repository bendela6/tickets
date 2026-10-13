// The engine: parsing, the registry, checking, drawing with the host's
// elements, the page copy and the block reference.
export * from './page';
export * from './parse';
export * from './registry';
export * from './render';
export { printType } from './print-type';
export { toPrompt } from './prompt';
export { toPage, type ToPageOptions } from './to-page';
export {
  validateDocument,
  type ValidationError,
  type ValidationResult,
  type ValidationWarning,
} from './validate';

// Drawn with @bh/ui: the blocks a page may use, the error card a host hands
// `DocView`, and Prose.
export * from './blocks';
export { BlockErrorCard } from './error-card';
export { Prose } from './prose';

// The highlighter code is coloured by lives in @bh/code, with CodeBlock (from
// './blocks'). It is exported here too, as it was before @bh/code, so an app
// switches its imports when it likes.
export {
  grammarFor,
  highlightLines,
  isBlankLine,
  LANGUAGES,
  SYNTAX_CLASSES,
  SYNTAX_HIGHLIGHTER,
  SYNTAX_TAGS,
  type Grammar,
  type SyntaxRole,
} from '@bh/code';
